import dcmjs from 'dcmjs';
import pako from 'pako'
import {
  DicomMetadataStore,
  IWebApiDataSource,
  utils,
  errorHandler,
  classes,
} from '@ohif/core';

import getImageId from '../DicomWebDataSource/utils/getImageId';
import _ from 'lodash';

const metadataProvider = classes.MetadataProvider;
const { datasetToBlob } = dcmjs.data;

const mappings = {
  studyInstanceUid: 'StudyInstanceUID',
  patientId: 'PatientID',
};

let _store = {
  urls: [],
  studyInstanceUIDMap: new Map(), // map of urls to array of study instance UIDs
  // {
  //   url: url1
  //   studies: [Study1, Study2], // if multiple studies
  // }
  // {
  //   url: url2
  //   studies: [Study1],
  // }
  // }
};

const getMetaDataByURL = url => {
  return _store.urls.find(metaData => metaData.url === url);
};

const getInstanceUrl = (url, prefix) => {
  let modifiedUrl = prefix
    ? url.replace(
      'https://storage.googleapis.com',
      `https://storage.googleapis.com/${prefix}`
    )
    : url;

  const dicomwebRegex = /^dicomweb:/
  modifiedUrl = modifiedUrl.includes(":zip//")
    ? modifiedUrl.replace(dicomwebRegex, 'dicomzip:')
    : modifiedUrl;

  return modifiedUrl;
}

const getMetadataFromRows = (rows, prefix, seriesuidArray) => {
  // TODO: bq should not have dups
  let filteredRows = rows.map(row => {
    row.instances = _.uniqBy(row.instances, (x)=>x.url)
    return row
  });

  if(!_.isEmpty(seriesuidArray)){
    filteredRows = filteredRows.filter(row=>{
      return seriesuidArray.includes(row.SeriesInstanceUID);
    })
  }

  const rowsByStudy = Object.values(
    filteredRows.reduce((rowsByStudy, row) => {
      const studyuid = row['StudyInstanceUID'];
      if (!rowsByStudy[studyuid]) rowsByStudy[studyuid] = [];
      rowsByStudy[studyuid].push(row);
      return rowsByStudy;
    }, {})
  );

  const studies = rowsByStudy.map(rows => {
    const studyNumInstances = rows.reduce((acc, row) => {
      return acc + (parseInt(row['NumInstances']) || 0);
    }, 0);

    const series = rows.map(row => {
      return {
        SeriesInstanceUID: row['SeriesInstanceUID'],
        Modality: row['Modality'],
        SeriesDescription: row['SeriesDescription'] || 'No description',
        StudyInstanceUID: row['StudyInstanceUID'],
        SeriesNumber: row['SeriesNumber'],
        SeriesTime: row['SeriesTime'],
        NumInstances: isNaN(parseInt(row['NumInstances']))
          ? 0
          : parseInt(row['NumInstances']),
        instances: row['instances'].map(instance => {
          return {
            metadata: instance.metadata,
            url: getInstanceUrl(instance.url, prefix),
          };
        }),
      };
    });

    return {
      StudyInstanceUID: rows[0]['StudyInstanceUID'],
      PatientName: rows[0]['PatientName'],
      PatientSex: rows[0]['PatientSex'],
      AccessionNumber: rows[0]['AccessionNumber'],
      StudyDate: rows[0]['StudyDate'],
      PatientID: rows[0]['PatientID'],
      PatientWeight: rows[0]['PatientWeight'],
      PatientAge: rows[0]['PatientAge'],
      StudyDescription: rows[0]['StudyDescription'] || 'No description',
      StudyTime: rows[0]['StudyTime'],
      NumInstances: studyNumInstances,
      Modalities: `["${rows[0]['Modality']}"]`,
      series: series,
    };
  });
  return {
    studies: studies,
  };
};

const getBigQueryRows = async (studyuids, seriesuid, access_token) => {
  const projectId = 'gradient-health-search';
  const query = `
    SELECT TO_JSON_STRING(t) FROM (
      SELECT
        StudyInstanceUID,
        SeriesInstanceUID,
        PatientID,
        StudyID,
        Modality,
        PatientName,
        PatientSex,
        AccessionNumber,
        StudyDate,
        PatientWeight,
        PatientAge,
        ParsedPatientAge,
        StudyDescription,
        StudyTime,
        NumInstances,
        SeriesDescription,
        SeriesNumber
        SeriesTime,
        instances
      FROM \`gradient-health-search.radiology.all-viewer-links\`
      WHERE StudyInstanceUID IN (${studyuids.map(s => `'${s}'`).join(', ')})
      ${seriesuid ? `AND SeriesInstanceUID = '${seriesuid}'` : ''}
    ) as t
  `;
  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
    {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        useLegacySql: false,
        location: 'us-central1',
        defaultDataset: {
          datasetId: 'radiology',
          projectId: 'gradient-health-search',
        },
      }),
      headers: {
        Authorization: 'Bearer ' + access_token,
        'Content-Type': 'application/json',
      },
    }
  );
  const data = await response.json();
  if (data) {
    return data?.rows.map(row => JSON.parse(row?.f?.[0]?.v));
  } else {
    return undefined;
  }
};

const filesFromStudyInstanceUID = async ({bucketName, prefix, studyuids, headers})=>{
  const studyMetadata = studyuids.map(async (studyuid) => {
    const folderPath = `${prefix}/${studyuid}/`;
    const delimiter = '/'
    const apiUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?prefix=${folderPath}&delimiter=${delimiter}`;
    const response = await fetch(apiUrl, { headers });
    const res = await response.json()
    const files = res.items || [];
    const folders = res.prefixes || [];
    const series = folders.map(async (folderPath)=>{
      const objectName = `${folderPath}metadata.json.gz`;
      const apiUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(objectName)}?alt=media`;
      const response = await fetch(apiUrl, { headers });
      return response.json()
    })
    return Promise.all(series)
  });
  return await Promise.all(studyMetadata)
}

const findStudies = (key, value) => {
  let studies = [];
  _store.urls.map(metaData => {
    metaData.studies.map(aStudy => {
      if (aStudy[key] === value) {
        studies.push(aStudy);
      }
    });
  });
  return studies;
};

const mapSegSeriesFromDataSet = (dataSet) => {
  return {
    Modality: dataSet.Modality,
    SeriesInstanceUID: dataSet.SeriesInstanceUID,
    SeriesDescription: dataSet.SeriesDescription,
    SeriesNumber: Number(dataSet.SeriesNumber),
    SeriesDate: dataSet.SeriesDate,
    SliceThickness:
      Number(dataSet.SharedFunctionalGroupsSequence.PixelMeasuresSequence
        .SliceThickness),
    StudyInstanceUID: dataSet.StudyInstanceUID,
    instances: [
      {
        metadata: {
          SOPInstanceUID: dataSet.SOPInstanceUID,
          SOPClassUID: dataSet.SOPClassUID,
          ReferencedSeriesSequence: dataSet.ReferencedSeriesSequence,
          SharedFunctionalGroupsSequence: dataSet.SharedFunctionalGroupsSequence,
        },
        url: dataSet.url,
      }
    ],
  };
};

const storeDicomSeg = async (naturalizedReport, headers) => {
  const {
    StudyInstanceUID,
    SeriesInstanceUID,
    SOPInstanceUID,
    SeriesDescription,
  } = naturalizedReport;

  const params = new URLSearchParams(window.location.search);
  const bucket = params.get('bucket') || 'gradient-health-search-viewer-links';
  const prefix = params.get('bucket-prefix') || 'dicomweb';

  const fileName = `${prefix}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/intances/${SOPInstanceUID}/${encodeURIComponent(
    SeriesDescription
  )}.dcm`;
  const segUploadUri = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${fileName}`;
  const blob = datasetToBlob(naturalizedReport);

  await fetch(segUploadUri, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/dicom',
    },
    body: blob,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(
          `${data.error.code}: ${data.error.message}` || 'Failed to store DicomSeg file'
        );
      }

      const segUri = `dicomweb:https://storage.googleapis.com/${bucket}/${data.name}`;
      // We are storing the imageId so that when naturalizedReport is made to displayset we can get url to DicomSeg file.
      naturalizedReport.url = segUri
      const segSeries = mapSegSeriesFromDataSet(naturalizedReport);
      const compressedFile = pako.gzip(JSON.stringify(segSeries));

      return fetch(
        `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${prefix}/${StudyInstanceUID}/${SeriesInstanceUID}/metadata.json.gz&contentEncoding=gzip`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: compressedFile,
        }
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            throw new Error(
              `${data.error.code}: ${data.error.message}` || 'Failed to store DicomSeg metadata'
            );
          }
        })
    })
};

let _dicomJsonConfig = null;

function createDicomJSONApi(dicomJsonConfig, servicesManager) {
  var { name, wadoRoot } = dicomJsonConfig;
  const init = config => {
    _dicomJsonConfig = config;
    name = _dicomJsonConfig.name;
    wadoRoot = _dicomJsonConfig.wadoRoot;
  };

  init(dicomJsonConfig);

  const implementation = {
    updateConfig: (dicomWebConfig) => {
      init(dicomWebConfig);
    },
    initialize: async ({ params, query, url }) => {
      if (!url) url = query.get('url');
      let metaData = getMetaDataByURL(url);

      // if we have already cached the data from this specific url
      // We are only handling one StudyInstanceUID to run; however,
      // all studies for patientID will be put in the correct tab
      if (metaData) {
        return metaData.studies.map(aStudy => {
          return aStudy.StudyInstanceUID;
        });
      }

      const { UserAuthenticationService } = servicesManager.services;
      const studyMetadata = await filesFromStudyInstanceUID({
        bucketName: query.get('bucket') || 'gradient-health-search-viewer-links',
        prefix: query.get('bucket-prefix') || 'dicomweb',
        studyuids: query.getAll('StudyInstanceUID'),
        headers: UserAuthenticationService.getAuthorizationHeader()
      });

      const data = getMetadataFromRows(
        _.flatten(studyMetadata), 
        query.get('prefix'), 
        query.getAll('SeriesInstanceUID')
      );      

      let StudyInstanceUID;
      let SeriesInstanceUID;
      data.studies.forEach(study => {
        StudyInstanceUID = study.StudyInstanceUID;

        study.series.forEach(series => {
          SeriesInstanceUID = series.SeriesInstanceUID;

          series.instances.forEach(instance => {
            const { url: imageId, metadata: naturalizedDicom } = instance;

            // Add imageId specific mapping to this data as the URL isn't necessarliy WADO-URI.
            metadataProvider.addImageIdToUIDs(imageId, {
              StudyInstanceUID,
              SeriesInstanceUID,
              SOPInstanceUID: naturalizedDicom.SOPInstanceUID,
            });
          });
        });
      });

      _store.urls.push({
        url,
        studies: [...data.studies],
      });

      _store.studyInstanceUIDMap.set(
        url,
        data.studies.map(study => study.StudyInstanceUID)
      );
    },
    query: {
      studies: {
        mapParams: () => { },
        search: async param => {
          const [key, value] = Object.entries(param)[0];
          const mappedParam = mappings[key];

          // todo: should fetch from dicomMetadataStore
          const studies = findStudies(mappedParam, value);

          return studies.map(aStudy => {
            return {
              accession: aStudy.AccessionNumber,
              date: aStudy.StudyDate,
              description: aStudy.StudyDescription,
              instances: aStudy.NumInstances,
              modalities: aStudy.Modalities,
              mrn: aStudy.PatientID,
              patientName: aStudy.PatientName,
              studyInstanceUid: aStudy.StudyInstanceUID,
              NumInstances: aStudy.NumInstances,
              time: aStudy.StudyTime,
            };
          });
        },
        processResults: () => {
          console.debug(' DICOMJson QUERY processResults');
        },
      },
      series: {
        // mapParams: mapParams.bind(),
        search: () => {
          console.debug(' DICOMJson QUERY SERIES SEARCH');
        },
      },
      instances: {
        search: () => {
          console.debug(' DICOMJson QUERY instances SEARCH');
        },
      },
    },
    retrieve: {
      directURL: params => {
        console.debug('Not implemented', params)
      },
      series: {
        metadata: ({
          StudyInstanceUID,
          madeInClient = false,
          customSort,
        } = {}) => {
          if (!StudyInstanceUID) {
            throw new Error(
              'Unable to query for SeriesMetadata without StudyInstanceUID'
            );
          }

          const study = findStudies('StudyInstanceUID', StudyInstanceUID)[0];
          let series;

          if (customSort) {
            series = customSort(study.series);
          } else {
            series = study.series;
          }

          const seriesSummaryMetadata = series.map(series => {
            const seriesSummary = {
              StudyInstanceUID: study.StudyInstanceUID,
              ...series,
            };
            delete seriesSummary.instances;
            return seriesSummary;
          });

          // Async load series, store as retrieved
          function storeInstances(naturalizedInstances) {
            DicomMetadataStore.addInstances(naturalizedInstances, madeInClient);
          }

          DicomMetadataStore.addSeriesMetadata(
            seriesSummaryMetadata,
            madeInClient
          );

          function setSuccessFlag() {
            const study = DicomMetadataStore.getStudy(
              StudyInstanceUID,
              madeInClient
            );
            study.isLoaded = true;
          }

          const numberOfSeries = series.length;
          series.forEach((series, index) => {
            const instances = series.instances.map(instance => {
              const obj = {
                ...instance.metadata,
                url: instance.url,
                imageId: instance.url,
                ...series,
                ...study,
              };
              delete obj.instances;
              delete obj.series;
              return obj;
            });
            storeInstances(instances);
            if (index === numberOfSeries - 1) setSuccessFlag();
          });
        },
      },
    },
    store: {
      dicom: async (dataset) => {
        if (dataset.Modality === 'SEG') {
          const headers = servicesManager.services.UserAuthenticationService.getAuthorizationHeader()
          try {
            await storeDicomSeg(dataset, headers)
          } catch (error) {
            throw error
          }
        } else {
          console.debug(' DICOMJson store dicom');
        }
      },
    },
    getImageIdsForDisplaySet(displaySet) {
      const images = displaySet.images;
      const imageIds = [];

      if (!images) {
        return imageIds;
      }

      displaySet.images.forEach(instance => {
        const NumberOfFrames = instance.NumberOfFrames;

        if (NumberOfFrames > 1) {
          for (let i = 0; i < NumberOfFrames; i++) {
            const imageId = getImageId({
              instance,
              frame: i,
              config: _dicomJsonConfig,
            });
            imageIds.push(imageId);
          }
        } else {
          const imageId = getImageId({ instance, config: _dicomJsonConfig });
          imageIds.push(imageId);
        }
      });

      return imageIds;
    },
    getImageIdsForInstance({ instance, frame }) {
      const imageIds = getImageId({
        instance,
        frame,
      });
      return imageIds;
    },

    getStudyInstanceUIDs: ({ params, query }) => {
      const url = query.get('url');
      return _store.studyInstanceUIDMap.get(url);
    },
  };
  return IWebApiDataSource.create(implementation);
}

export { createDicomJSONApi };
