import { eventTarget, Enums, cache } from '@cornerstonejs/core';
import { utilities as csToolsUtils } from '@cornerstonejs/tools';
import { DicomMetadataStore, pubSubServiceInterface } from '@ohif/core';
import { alphabet } from './utils';

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
    this.extensionManager = extensionManager;
    this.DicomMetadataStore = DicomMetadataStore;
    Object.assign(this, pubSubServiceInterface);
  }

  cacheNearbyStudyInstanceUIDs(id, bufferBack, bufferFront) {
    const { CacheAPIService } = this.serviceManager.services;
    const index = this.studyUIDToIndex[id];
    const min = index - bufferBack < 2 ? 2 : index - bufferBack;
    const max = index + bufferFront;
    const urlIndex = this.formHeader.findIndex((name) => name == 'URL');
    this.rows.slice(min - 1, max).forEach((row) => {
      const url = row[urlIndex];
      const params = new URLSearchParams('?' + url.split('?')[1]);
      const StudyInstanceUID = getStudyInstanceUIDFromParams(params);
      CacheAPIService.cacheStudy(StudyInstanceUID, params.getAll('bucket'));
    });
  }

  setFormByStudyInstanceUID(id) {
    const index = this.studyUIDToIndex[id];
    this.setFormByIndex(index);
    this.cacheNearbyStudyInstanceUIDs(id, 2, 32);
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

      if (window.location.pathname.startsWith('/segmentation')) {
        // Since sheet panel only used by segmentation and breast density mode,
        // and breast density mode does not handles segmentation we are only loading
        // segmentations in segmentation mode.
        eventTarget.addEventListener(
          Enums.Events.STACK_VIEWPORT_NEW_STACK,
          () => loadSegFiles(this.serviceManager)
        );
      }

      if (!params.get('sheetId'))
        return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
      if (!params.get('sheetName'))
        return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
      this.sheetId = params.get('sheetId');
      this.sheetName = params.get('sheetName');

      // Get settings config from sheets
      this.settings = await this.readRange(1, 6, this.sheetId, 'Settings');

      // Get values for current row from sheets
      this.formHeader = (await this.readRange(1, 1)).values[0];

      // TODO: Handle more than MAX_ROWS
      this.rows = (await this.readRange(1, MAX_ROWS)).values;
      this.formHeader = this.rows[0];

      const urlIndex = this.formHeader.findIndex((name) => name == 'URL');
      this.studyUIDToIndex = this.rows.slice(1).reduce((prev, curr, idx) => {
        const url = curr[urlIndex];
        const params = new URLSearchParams('?' + url.split('?')[1]);
        const StudyInstanceUID = getStudyInstanceUIDFromParams(params);

        // Google Sheets is 1-indexed and we ignore first row as header row thus + 2
        prev[StudyInstanceUID] = idx + 2;
        return prev;
      }, {});

      this.index = this.studyUIDToIndex[getStudyInstanceUIDFromParams(params)];

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

      this.setFormByStudyInstanceUID(getStudyInstanceUIDFromParams(params));
    } catch (e) {
      console.error(e);
      this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
    }
  }

  readFormValue(x) {
    return this.formTemplate.map((ele) => {
      const index = this.formHeader.findIndex((name) => name == ele.name);
      if (index !== -1) {
        return convertFormValues(x[index]);
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

  async writeFormToRow(formValue) {
    const values = this.formHeader.map((colName) => {
      const index = this.formTemplate.findIndex((ele) => {
        return colName == ele.name;
      });
      if (index > 0) {
        return formValue[index];
      }

      if (colName === 'Updated By') {
        const user =
          this.serviceManager.services.UserAuthenticationService.getUser();
        return JSON.stringify({
          email: user.profile.email,
          picture: user.profile.picture,
          lastUpdated: Date.now(),
        });
      }
      return null;
    });

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
      const {
        DisplaySetService,
        HangingProtocolService,
        CacheAPIService,
        SegmentationService,
      } = this.serviceManager.services;
      const rowValues = this.rows[this.index + delta - 1];
      if (!rowValues) {
        window.location.href = `https://docs.google.com/spreadsheets/d/${this.sheetId}`;
      }
      const index = this.formHeader.findIndex((name) => name == 'URL');
      const url = rowValues[index];
      const params = new URLSearchParams('?' + url.split('?')[1]);
      const StudyInstanceUID = getStudyInstanceUIDFromParams(params);
      const buckets = params.getAll('bucket');
      if (!StudyInstanceUID) {
        window.location.href = `https://docs.google.com/spreadsheets/d/${this.sheetId}`;
      }
      const dataSource = this.extensionManager.getActiveDataSource()[0];
      await dataSource.retrieve.series.metadata({ StudyInstanceUID, buckets });
      const studies = [DicomMetadataStore.getStudy(StudyInstanceUID)];
      const activeProtocolId =
        HangingProtocolService.getActiveProtocol().protocol.id;
      HangingProtocolService.reset();
      HangingProtocolService.run(
        {
          studies,
          activeStudy: studies[0],
          displaySets: DisplaySetService.getActiveDisplaySets().filter(
            (ele) => {
              return ele.StudyInstanceUID === StudyInstanceUID;
            }
          ),
        },
        activeProtocolId
      );
      const segmentations = SegmentationService.getSegmentations();
      segmentations.forEach((segmentation) =>
        SegmentationService.remove(segmentation.id)
      );

      const nextParams = new URLSearchParams(window.location.search);
      if (nextParams.get('StudyInstanceUIDs'))
        nextParams.set('StudyInstanceUIDs', StudyInstanceUID);
      else {
        nextParams.set('StudyInstanceUID', StudyInstanceUID);
      }
      nextParams.delete('bucket');
      buckets.forEach((bucket) => {
        nextParams.append('bucket', bucket);
      });

      const nextURL =
        window.location.href.split('?')[0] + '?' + nextParams.toString();
      window.history.replaceState({}, null, nextURL);
      this.setFormByStudyInstanceUID(StudyInstanceUID);
      CacheAPIService.setViewedStudy(StudyInstanceUID);
    } catch (e) {
      console.error(e);
    }
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

function loadSegFiles(serviceManager) {
  const params = new URLSearchParams(window.location.search);
  const studyInstanceUID = getStudyInstanceUIDFromParams(params);

  const segSOPClassUIDs = ['1.2.840.10008.5.1.4.1.1.66.4'];
  const {
    segmentationService,
    displaySetService,
    UserAuthenticationService,
    CacheAPIService,
  } = serviceManager.services;
  const headers = UserAuthenticationService.getAuthorizationHeader();

  const activeStudySegDisplaySets = displaySetService.getDisplaySetsBy(
    (ds) =>
      ds.StudyInstanceUID === studyInstanceUID &&
      segSOPClassUIDs.includes(ds.SOPClassUID)
  );
  const nonSegImageIds = displaySetService
    .getDisplaySetsBy(
      (ds) =>
        ds.StudyInstanceUID === studyInstanceUID &&
        !segSOPClassUIDs.includes(ds.SOPClassUID)
    )
    .flatMap((ds) => ds.images.flatMap((image) => image.imageId));

  const isAllSegmentationsLoaded = isAllSegmentationsOfSeriesLoaded(
    activeStudySegDisplaySets,
    serviceManager
  );

  if (isAllSegmentationsLoaded) {
    const renderedToolGroupIds = [];

    activeStudySegDisplaySets.forEach((ds) => {
      const toolGroupIds = segmentationService.getToolGroupIdsWithSegmentation(
        ds.displaySetInstanceUID
      );
      toolGroupIds.forEach((toolGroupId) => {
        if (renderedToolGroupIds.includes(toolGroupId)) {
          return;
        }

        csToolsUtils.segmentation.triggerSegmentationRender(toolGroupId);
        renderedToolGroupIds.push(toolGroupId);
      });
    });

    return;
  }

  const isAllSeriesOfStudyCached = () => {
    return nonSegImageIds.every((imageId) => cache.getImageLoadObject(imageId));
  };

  let unsubscribe;

  const loadSegmentations = async () => {
    if (isAllSeriesOfStudyCached()) {
      const loadPromises = activeStudySegDisplaySets.map(async (displaySet) => {
        displaySet.getReferenceDisplaySet();
        return displaySet.load({ headers });
      });

      await Promise.all(loadPromises);

      activeStudySegDisplaySets.forEach(
        async (displaySet) =>
          await segmentationService.addSegmentationRepresentationToToolGroup(
            'default',
            displaySet.displaySetInstanceUID,
            true
          )
      );

      unsubscribe?.();
    }
  };

  if (isAllSeriesOfStudyCached()) {
    loadSegmentations();
  } else {
    ({ unsubscribe } = CacheAPIService.subscribe(
      CacheAPIService.EVENTS.IMAGE_CACHE_PREFETCHED,
      loadSegmentations
    ));
  }
}

function isAllSegmentationsOfSeriesLoaded(
  activeStudySegDisplaySets,
  servicesManager
) {
  const { segmentationService } = servicesManager.services;

  return activeStudySegDisplaySets.every((ds) =>
    segmentationService.getSegmentation(ds.displaySetInstanceUID)
  );
}

function getStudyInstanceUIDFromParams(params) {
  // Breast OHIF dicomweb datasource uses StudyInstanceUIDs, but bq datasource uses StudyInstanceUID
  return params.get('StudyInstanceUIDs') || params.get('StudyInstanceUID');
}
