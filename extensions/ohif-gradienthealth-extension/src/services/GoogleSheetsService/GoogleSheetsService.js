import { metaData, utilities } from '@cornerstonejs/core';
import {
  DicomMetadataStore,
  pubSubServiceInterface,
  utils as ohifUtils,
} from '@ohif/core';
import { alphabet } from './utils';
import { addLoadSegmentationsListener } from '../../utils/loadSegmentations';
import { Enums as CSExtensionEnums } from '@ohif/extension-cornerstone';

const MAX_ROWS = 100000;

const EVENTS = {
  GOOGLE_SHEETS_CHANGE: 'event::gradienthealth::GoogleSheets:FormChange',
  GOOGLE_SHEETS_ERROR: 'event::gradienthealth::GoogleSheets:Error',
  GOOGLE_SHEETS_DESTROY: 'event::gradienthealth::GoogleSheets:Destroy',
};

const convertFormValues = (v) => {
  switch (v) {
    case 'TRUE':
      return true;
    case 'FALSE':
      return false;
    case 'YES':
      return true;
    case 'NO':
      return false;
    case '':
      return null;
    case undefined:
      return null;
  }
  return v;
};

export default class GoogleSheetsService {
  constructor(serviceManager, commandsManager, extensionManager) {
    this.serviceManager = serviceManager;
    this.listeners = {};
    this.api_key = 'AIzaSyDu5Rt54oHX1w3O5kZTARz7DClaxNjTpEs'; // This is our API key
    this.EVENTS = EVENTS;
    this.sheetId = null;
    this.index = null;
    this.sheetName = null;
    this.formTemplate = null;
    this.formValue = null;
    this.settings = null;
    this.formHeader = null;
    this.rows = null;
    this.studyUIDToIndex = {};
    this.commandsManager = commandsManager;
    this.extensionManager = extensionManager;
    this.DicomMetadataStore = DicomMetadataStore;

    // A flag to store whether the displayset filtering using invalid series uid from URL is handled.
    this.hasHandledInvalidSeriesFiltering = false;

    Object.assign(this, pubSubServiceInterface);
  }

  cacheNearbyStudyInstanceUIDs(ids, bufferBack, bufferFront) {
    const { CacheAPIService } = this.serviceManager.services;
    const targetRowUniqueId = this.createRowUniqueId(
      ids.studyInstanceUIDs,
      ids.seriesInstanceUIDs
    );
    const index = this.studyUIDToIndex[targetRowUniqueId];
    const min = index - bufferBack < 2 ? 2 : index - bufferBack;
    const max = index + bufferFront;
    const urlIndex = this.getFormColumnIndex('URL');

    const rowsToCache = this.rows.slice(min - 1, max);
    const uniqueStudiesMap = new Map();
    rowsToCache.forEach((row) => {
      const params = new URLSearchParams('?' + row[urlIndex].split('?')[1]);
      const studyInstanceUIDs = params.getAll('StudyInstanceUIDs');
      const seriesInstanceUIDs = params.getAll('SeriesInstanceUIDs');

      const rowUniqueId = this.createRowUniqueId(
        studyInstanceUIDs,
        seriesInstanceUIDs
      );

      studyInstanceUIDs.forEach((studyInstanceUID) => {
        uniqueStudiesMap.set(rowUniqueId, {
          rowUniqueId,
          studyInstanceUID,
          seriesInstanceUIDs: params.getAll('SeriesInstanceUIDs'),
          buckets: params.getAll('bucket'),
          bucketPrefix: params.get('bucket-prefix'),
        });
      });
    });

    const studiesFilteredOfDuplicates = Array.from(uniqueStudiesMap.values());
    let indexOfCurrentRow = null,
      studiesInCurrentRow = 0;

    for (const [index, study] of studiesFilteredOfDuplicates.entries()) {
      if (study.rowUniqueId === targetRowUniqueId) {
        indexOfCurrentRow ??= index;
        studiesInCurrentRow++;
      }
    }
    const element = studiesFilteredOfDuplicates.splice(
      indexOfCurrentRow,
      studiesInCurrentRow
    );
    studiesFilteredOfDuplicates.unshift(element[0]); // making the current studyid as first element

    // Cache the studies one by one, after completely fetching the previous one.
    studiesFilteredOfDuplicates.reduce((promise, study) => {
      return promise.then(() => {
        return CacheAPIService.cacheStudy(
          study.studyInstanceUID,
          study.seriesInstanceUIDs,
          study.buckets,
          study.bucketPrefix
        );
      });
    }, Promise.resolve());
  }

  setFormByStudyInstanceUID(ids) {
    const rowUniqueId = this.createRowUniqueId(
      ids.studyInstanceUIDs,
      ids.seriesInstanceUIDs
    );
    const index = this.studyUIDToIndex[rowUniqueId];
    this.setFormByIndex(index);
    this.loadAnnotationsFromSheet(index);
    this.cacheNearbyStudyInstanceUIDs(ids, 2, 32);
  }

  setFormByIndex(index) {
    this.index = index;
    const rowValues = this.rows[index - 1]; // google sheets is 1-indexed
    this.formValue = this.readFormValue(rowValues);
    this._broadcastEvent(EVENTS.GOOGLE_SHEETS_CHANGE);
  }

  async init() {
    try {
      const { UserAuthenticationService } = this.serviceManager.services;
      this.user = UserAuthenticationService.getUser();
      const params = new URLSearchParams(window.location.search);

      if (
        ['/segmentation', '/viewer'].some((path) =>
          window.location.pathname.includes(path)
        )
      ) {
        // Since sheet panel only used by longitudinal, segmentation and breast density mode,
        // and breast density mode does not handles segmentation we are only loading
        // segmentations in longitudinal and segmentation mode.
        addLoadSegmentationsListener(this.serviceManager);
      }

      if (!params.get('sheetId'))
        return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
      if (!params.get('sheetName'))
        return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
      this.sheetId = params.get('sheetId');
      this.sheetName = params.get('sheetName');

      // Get settings config from sheets
      this.settings = await this.readRange(1, 7, this.sheetId, 'Settings');

      // Get values for current row from sheets
      this.formHeader = (await this.readRange(1, 1)).values[0];

      // TODO: Handle more than MAX_ROWS
      this.rows = (await this.readRange(1, MAX_ROWS)).values;
      this.formHeader = this.rows[0];
      const urlIndex = this.getFormColumnIndex('URL');
      this.studyUIDToIndex = this.rows.slice(1).reduce((prev, curr, idx) => {
        const url = curr[urlIndex];
        const params = new URLSearchParams('?' + url.split('?')[1]);
        const StudyInstanceUIDs = params.getAll('StudyInstanceUIDs');
        const SeriesInstanceUIDs = params.getAll('SeriesInstanceUIDs');

        const rowUniqueId = this.createRowUniqueId(
          StudyInstanceUIDs,
          SeriesInstanceUIDs
        );

        // Google Sheets is 1-indexed and we ignore first row as header row thus + 2
        prev[rowUniqueId] = idx + 2;
        return prev;
      }, {});

      const currentRowUniqueId = this.createRowUniqueId(
        params.getAll('StudyInstanceUIDs'),
        params.getAll('SeriesInstanceUIDs')
      );
      this.index = this.studyUIDToIndex[currentRowUniqueId];

      // Map formTemplate and formValue
      const values = this.settings.values[0].map((_, colIndex) =>
        this.settings.values.map((row) => row[colIndex])
      );
      const header = values[0];
      this.formTemplate = values
        .slice(1, -1)
        .map((col) => {
          return col.reduce((obj, curr, idx) => {
            curr = convertFormValues(curr);

            switch (header[idx]) {
              case 'template':
                try {
                  if (curr) obj[header[idx]] = JSON.parse(curr);
                } catch (e) {
                  console.warn(curr, e);
                }
                break;
              case 'order':
                obj[header[idx]] = Number(curr);
                break;
              default:
                obj[header[idx]] = curr;
            }
            return obj;
          }, {});
        })
        .filter((ele) => {
          return ele.show;
        })
        .sort((a, b) => a.order - b.order);

      this.setFormByStudyInstanceUID({
        studyInstanceUIDs: params.getAll('StudyInstanceUIDs'),
        seriesInstanceUIDs: params.getAll('SeriesInstanceUIDs'),
      });
    } catch (e) {
      console.error(e);
      this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
    }
  }

  readFormValue(x) {
    return this.formTemplate.map((ele) => {
      const index = this.getFormColumnIndex(ele.name);
      if (index !== -1) {
        return convertFormValues(x[index]);
      }
    });
  }

  writeFormValue(x, values) {
    return this.formTemplate.map((ele) => {
      const index = this.getFormColumnIndex(ele.name);
      if (index !== -1) {
        x[index] = values[ele.order - 1];
      }
    });
  }

  async readRange(
    min,
    max,
    sheetId = this.sheetId,
    sheetName = this.sheetName
  ) {
    const range = `A${min}:ZZ${max}`;
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}`;
    const response = await fetch(baseUrl, {
      headers: {
        Authorization: 'Bearer ' + this.user['access_token'],
      },
    });
    const responseJson = await response.json();
    return responseJson;
  }

  // Must be XHR to avoid sheets CORS issue
  writeRange(sheetId, sheetName, range, values) {
    return new Promise((resolve, reject) => {
      let baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}?valueInputOption=USER_ENTERED`;
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', baseUrl);
      xhr.setRequestHeader('Content-type', 'application/json');
      xhr.setRequestHeader(
        'Authorization',
        'Bearer ' + this.user['access_token']
      );
      xhr.onload = () => {
        if (xhr.status == 200) {
          resolve();
        } else {
          reject();
        }
      };
      xhr.send(
        JSON.stringify({
          range: `${sheetName}!${range}`,
          majorDimension: 'ROWS',
          values: [values],
        })
      );
    });
  }

  async updateRow(formValue) {
    const values = this.formHeader.map((colName) => {
      const index = this.formTemplate.findIndex((ele) => {
        return colName === ele.columnName || colName === ele.name;
      });
      // Handle all userProfile/ last updated column values
      const userLastUpdated = this.getUserLastUpdated(colName);
      if (userLastUpdated) {
        return userLastUpdated;
      }

      if (index >= 0) {
        return formValue[index];
      }

      return null;
    });

    // google sheets is 1-indexed, so take rows[index-1]
    const updatedFormValue = this.rows[this.index - 1].map((element, index) =>
      values[index] !== null ? values[index] : element
    );

    this.rows[this.index - 1] = updatedFormValue;
    this.formValue = updatedFormValue;

    await this.writeRange(
      this.sheetId,
      this.sheetName,
      `A${this.index}:${alphabet[this.formHeader.length - 1]}${this.index}`,
      values
    );
    return values;
  }

  getFormTemplate() {
    return this.formTemplate ? this.formTemplate : null;
  }

  getFormValue() {
    return this.formValue ? this.formValue : null;
  }

  async getRow(delta) {
    try {
      const { DisplaySetService, HangingProtocolService, CacheAPIService } =
        this.serviceManager.services;
      const rowValues = this.rows[this.index + delta - 1];
      if (!rowValues) {
        window.location.href = `https://docs.google.com/spreadsheets/d/${this.sheetId}`;
      }
      const index = this.getFormColumnIndex('URL');
      const url = rowValues[index];
      const params = new URLSearchParams('?' + url.split('?')[1]);
      const StudyInstanceUIDs = params.getAll('StudyInstanceUIDs');
      const SeriesInstanceUIDs = params.getAll('SeriesInstanceUIDs');
      const buckets = params.getAll('bucket');
      const bucketPrefix = params.get('bucket-prefix');
      if (!StudyInstanceUIDs?.length) {
        window.location.href = `https://docs.google.com/spreadsheets/d/${this.sheetId}`;
      }
      const dataSource = this.extensionManager.getActiveDataSource()[0];
      await Promise.all(
        StudyInstanceUIDs.map((studyInstanceUID) =>
          dataSource.retrieve.series.metadata({
            StudyInstanceUID: studyInstanceUID,
            bucketDetails: { buckets, bucketPrefix },
            ...(SeriesInstanceUIDs.length
              ? { filters: { seriesInstanceUID: SeriesInstanceUIDs } }
              : {}),
          })
        )
      );

      const studies = [];
      for (const studyInstanceUID of StudyInstanceUIDs) {
        const study = DicomMetadataStore.getStudy(studyInstanceUID);

        const filteredSeries = study.series.filter(
          (aSeries) =>
            !SeriesInstanceUIDs.length ||
            SeriesInstanceUIDs.includes(aSeries.DeidSeriesInstanceUID)
        );

        if (filteredSeries.length) {
          studies.push({
            ...study,
            series: filteredSeries,
          });
        }
      }

      const activeProtocolId =
        HangingProtocolService.getActiveProtocol().protocol.id || 'default';
      HangingProtocolService.run(
        {
          studies,
          activeStudy: studies[0],
          displaySets: DisplaySetService.getActiveDisplaySets().filter(
            (ele) => {
              return (
                StudyInstanceUIDs.includes(ele.StudyInstanceUID) &&
                (!SeriesInstanceUIDs.length ||
                  SeriesInstanceUIDs.includes(ele.SeriesInstanceUID))
              );
            }
          ),
        },
        activeProtocolId
      );

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('StudyInstanceUIDs');
      if (StudyInstanceUIDs.length) {
        StudyInstanceUIDs.forEach((studyUID) => {
          nextParams.append('StudyInstanceUIDs', studyUID);
        });
      }
      nextParams.delete('SeriesInstanceUIDs');
      if (SeriesInstanceUIDs.length) {
        SeriesInstanceUIDs.forEach((seriesUID) => {
          nextParams.append('SeriesInstanceUIDs', seriesUID);
        });
      }
      nextParams.delete('bucket');
      nextParams.delete('bucket-prefix');
      if (buckets.length) {
        buckets.forEach((bucketName) => {
          nextParams.append('bucket', bucketName);
        });
      }
      if (bucketPrefix) {
        nextParams.append('bucket-prefix', bucketPrefix);
      }
      const nextURL =
        window.location.href.split('?')[0] + '?' + nextParams.toString();
      window.history.replaceState({}, null, nextURL);
      // The current functionalities of CacheAPIService.setViewedStudy function is already done here.
      // await CacheAPIService.setViewedStudy(StudyInstanceUIDs[0]);
      this.setFormByStudyInstanceUID({
        studyInstanceUIDs: StudyInstanceUIDs,
        seriesInstanceUIDs: SeriesInstanceUIDs,
      });
      this.setHasHandledInvalidSeriesFiltering(false);
    } catch (e) {
      console.error(e);
    }
  }

  getFormColumnIndex(name) {
    const nameRow = this.settings.values.find((row) => row[0] === 'name');
    const columnNameRow = this.settings.values.find(
      (row) => row[0] === 'columnName'
    );

    const columnNameMap =
      nameRow && columnNameRow
        ? nameRow.map((name, index) => [name, columnNameRow[index]])
        : [];

    const urlColumnName = Object.fromEntries(columnNameMap)?.[name] || name;
    if (urlColumnName) {
      return this.formHeader.findIndex((name) => name === urlColumnName);
    }

    // Find the column in the sheet if not in the config
    return this.formHeader.findIndex((header) => header === name);
  }

  getSheetConfig() {
    try {
      const nameRow = this.settings.values.find((row) => row[0] === 'name');
      const templateRow = this.settings.values.find(
        (row) => row[0] === 'template'
      );
      const configIndex = nameRow.findIndex((value) => value === 'CONFIG');
      return JSON.parse(templateRow[configIndex]);
    } catch (error) {
      console.warn('Error parsing Google sheets Config');
      return {};
    }
  }

  getUserLastUpdated(columnName) {
    const config = this.getSheetConfig();
    const users = config.users || [];

    if (users.length && users.includes(columnName)) {
      const rowValues = this.rows[this.index - 1];

      const targetColumnName = users.find((userColumnName) => {
        const columnIndex = this.getFormColumnIndex(userColumnName);
        const userEmail = rowValues[columnIndex];
        return !userEmail || userEmail === this.user.profile.email;
      });

      if (targetColumnName === columnName) {
        return this.user.profile.email;
      }
    }

    if (columnName === 'Updated By') {
      return JSON.stringify({
        email: this.user.profile.email,
        picture: this.user.profile.picture,
        lastUpdated: Date.now(),
      });
    }

    return null;
  }

  createRowUniqueId(studyInstanceUIDs = [], seriesInstanceUIDs = []) {
    return `${studyInstanceUIDs.sort().join('+')}_${
      seriesInstanceUIDs.sort().join('+') || 'NO-SERIES-FILTER'
    }`;
  }

  getHasHandledInvalidSeriesFiltering() {
    return this.hasHandledInvalidSeriesFiltering;
  }

  setHasHandledInvalidSeriesFiltering(value) {
    this.hasHandledInvalidSeriesFiltering = value;
  }

  loadAnnotationsFromSheet(rowIndex) {
    const dataSource = this.extensionManager.getActiveDataSource()[0];
    const phiBoundingBoxes = this.getPHIBoundingBoxes(
      rowIndex,
      dataSource.getConfig().name
    );

    const { MeasurementService } = this.serviceManager.services;

    const annotationType = 'PHIBoundingBox';

    const {
      CORNERSTONE_3D_TOOLS_SOURCE_NAME,
      CORNERSTONE_3D_TOOLS_SOURCE_VERSION,
    } = CSExtensionEnums;

    const mappings = MeasurementService.getSourceMappings(
      CORNERSTONE_3D_TOOLS_SOURCE_NAME,
      CORNERSTONE_3D_TOOLS_SOURCE_VERSION
    );
    const source = MeasurementService.getSource(
      CORNERSTONE_3D_TOOLS_SOURCE_NAME,
      CORNERSTONE_3D_TOOLS_SOURCE_VERSION
    );
    const matchingMapping = mappings.find(
      (m) => m.annotationType === annotationType
    );

    phiBoundingBoxes.forEach(({ imageId, boxWorldCoords }, index) => {
      const imagePlaneModule = metaData.get('imagePlaneModule', imageId);
      const frameOfReferenceUID = imagePlaneModule?.frameOfReferenceUID;

      const annotation = {
        annotationUID: ohifUtils.guid(),
        highlighted: false,
        invalidated: true,
        isLocked: false,
        isVisible: true,
        metadata: {
          toolName: 'PHIBoundingBox',
          referencedImageId: imageId,
          FrameOfReferenceUID: frameOfReferenceUID,
        },
        data: {
          handles: {
            points: [
              [...boxWorldCoords[0]],
              [...boxWorldCoords[1]],
              [...boxWorldCoords[2]],
              [...boxWorldCoords[3]],
            ],
            activeHandleIndex: null,
            textBox: {
              hasMoved: false,
              worldPosition: [0, 0, 0],
              worldBoundingBox: {
                topLeft: [0, 0, 0],
                topRight: [0, 0, 0],
                bottomLeft: [0, 0, 0],
                bottomRight: [0, 0, 0],
              },
            },
          },
          cachedStats: {},
          label: `PHI Bounding Box ${index + 1}`,
        },
        isSelected: false,
      };

      const newAnnotationUID = MeasurementService.addRawMeasurement(
        source,
        annotationType,
        { annotation },
        matchingMapping.toMeasurementSchema,
        dataSource
      );

      this.commandsManager.runCommand('updateMeasurement', {
        uid: newAnnotationUID,
        code: annotation.data.finding,
      });
    });
  }

  getPHIBoundingBoxes(rowIndex, dataSourceName) {
    const settingsNameRow = this.settings.values.find(
      (row) => row[0] === 'name'
    );
    const settingsTypeRow = this.settings.values.find(
      (row) => row[0] === 'type'
    );

    const phiSectionTemplateIndex = settingsTypeRow.findIndex(
      (type) => type === 'phi_box_section'
    );
    const phiBoundingBoxesColumnIndex = this.getFormColumnIndex(
      settingsNameRow[phiSectionTemplateIndex]
    );

    const phiBoundingBoxes = [];
    try {
      const parsedValue = JSON.parse(
        this.rows[rowIndex - 1][phiBoundingBoxesColumnIndex]
      );

      Object.entries(parsedValue).forEach(([imageId, boxes]) => {
        const formattedImageId = `${dataSourceName}:${imageId}`;
        boxes.forEach(([topLeft, bottomRight]) => {
          const boxImageCoords = [
            [topLeft[0], topLeft[1]],
            [bottomRight[0], topLeft[1]],
            [topLeft[0], bottomRight[1]],
            [bottomRight[0], bottomRight[1]],
          ];

          const boxWorldCoords = boxImageCoords.map((imageCoords) =>
            utilities.imageToWorldCoords(formattedImageId, imageCoords)
          );

          phiBoundingBoxes.push({
            imageId: formattedImageId,
            boxWorldCoords,
          });
        });
      });
    } catch (error) {
      console.warn(`Error parsing sheet PHI bounding boxes:${error.message}`);
    }

    return phiBoundingBoxes;
  }

  destroy() {
    this.sheetId = null;
    this.index = null;
    this.sheetName = null;
    this.formTemplate = null;
    this.formValue = null;
    this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
  }
}
