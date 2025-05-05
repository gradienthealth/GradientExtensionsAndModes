import { DicomMetadataStore, pubSubServiceInterface } from '@ohif/core';
import { internal } from '@cornerstonejs/dicom-image-loader';
const { getOptions } = internal;
import _ from 'lodash';
import {
  eventTarget,
  EVENTS,
  Enums,
  imageLoader,
  imageLoadPoolManager,
} from '@cornerstonejs/core';

const LOCAL_EVENTS = {};

export default class CacheAPIService {
  listeners: { [key: string]: Function[] };
  EVENTS: { [key: string]: string };
  element: HTMLElement;
  private commandsManager;
  private extensionManager;
  private dataSource;
  private options;
  public storageUsage;
  public storageQuota;

  constructor(servicesManager, commandsManager, extensionManager) {
    this.listeners = {};
    this.EVENTS = LOCAL_EVENTS;
    this.commandsManager = commandsManager;
    this.extensionManager = extensionManager;
    this.storageUsage = null;
    this.storageQuota = null;
    Object.assign(this, pubSubServiceInterface);
  }

  public init() {
    // Need to add event listener if datasource changes
    const dataSources = this.extensionManager.getActiveDataSource();
    this.dataSource = dataSources[0];

    eventTarget.addEventListener(
      'CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR',
      this.handleQuotaExceededWriteError.bind(this)
    );

    if (window?.navigator?.storage?.estimate) {
      window?.navigator?.storage?.estimate().then((estimate) => {
        console.log(
          'Storage use: ',
          estimate.usage * 1e-9,
          ' of ',
          estimate.quota * 1e-9,
          ' GB'
        );
        this.storageUsage = estimate.usage;
        this.storageQuota = estimate.quota;
      });
    }

    if (
      window?.navigator?.storage?.persisted &&
      window?.navigator?.storage?.persist
    ) {
      window?.navigator?.storage?.persisted().then((persistent) => {
        if (!persistent) {
          window?.navigator?.storage?.persist().then((persistent) => {
            if (persistent) {
              console.log(
                'Storage will not be cleared except by explicit user action'
              );
            } else {
              console.log(
                'Storage may be cleared by the UA under storage pressure.'
              );
            }
          });
        } else {
          console.log(
            'Storage will not be cleared except by explicit user action'
          );
        }
      });
    }
  }

  public async setViewedStudy(StudyInstanceUID) {
    await this.dataSource.retrieve.series.metadata({ StudyInstanceUID });
    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    const imageIds = study.series.flatMap((serie) =>
      serie.instances.flatMap((instance) => instance.imageId)
    );
    const urls = imageIds.map((imageId) =>
      imageId.split(':').slice(1).join(':')
    );
    const options = getOptions();
    const getScope = options.cache.getScope;
    const scopes = _.uniq(urls.map((url) => getScope({ url })));
    scopes.forEach(async (scope) => {
      const cache = await caches.open(scope);
      const keys = await cache.keys();
      keys.forEach(async (key) => {
        const res = await cache.match(key.url, {
          ignoreVary: true,
          ignoreMethod: true,
          ignoreSearch: true,
        });
        if(!res) return
        const req = new Request(key.url, {
          headers: {
            'dicom-last-put-date': new Date().toUTCString(),
            'dicom-last-viewed-date': new Date().toUTCString(),
            'dicom-content-length': key.headers.get('dicom-content-length')
          },
        });
        if (res) {
          cache.put(req, res);
        }
      });
    });
  }

  public async cacheStudy(StudyInstanceUID) {
    await this.dataSource.retrieve.series.metadata({ StudyInstanceUID });
    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    const imageIds = study.series.flatMap((serie) =>
      serie.instances.flatMap((instance) => instance.imageId)
    );
    this.cacheImageIds(imageIds);
  }

  public async cacheSeries(StudyInstanceUID, SeriesInstanceUID) {
    await this.dataSource.retrieve.series.metadata({ StudyInstanceUID });
    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    const imageIds = study.series
      .filter((serie) => serie.SeriesInstanceUID === SeriesInstanceUID)
      .flatMap((serie) =>
        serie.instances.flatMap((instance) => instance.imageId)
      );
    this.cacheImageIds(imageIds);
  }

  public cacheImageIds(imageIds) {
    function sendRequest(imageId, options) {
      return imageLoader.loadAndCacheImage(imageId, options).then(
        () => {},
        (error) => {
          console.error(error);
        }
      );
    }

    const priority = 0;
    const requestType = Enums.RequestType.Prefetch;
    const options = {
      preScale: {
        enabled: true,
      },
      useRGBA: true,
    };

    imageIds.forEach((imageId) => {
      const additionalDetails = { imageId };
      imageLoadPoolManager.addRequest(
        sendRequest.bind(this, imageId, options),
        requestType,
        additionalDetails,
        priority
      );
    });
  }

  public async cacheMissingStudyImageIds(StudyInstanceUIDs) {
    const existingKeys = await window.caches.keys();
    const existingStudyInstanceUIDs = existingKeys.map(
      (key) => key.split('studies/')[1].split('/')[0]
    );
    const newStudies = StudyInstanceUIDs.filter(
      (studyuid) => existingStudyInstanceUIDs.indexOf(studyuid) === -1
    );
    newStudies.forEach((studyuid) => {
      this.cacheStudy(studyuid);
    });
  }

  /**
   * Removes all cached images which have been seen.
   * @param evt
   * @returns
   */
  private async handleQuotaExceededWriteError(evt) {
    const scopes = await window.caches.keys();
    scopes.forEach(async (scope) => {
      try {
        const cache = await caches.open(scope);
        const k = await cache.keys();
        const lastViewed = k[0].headers.get('dicom-last-viewed-date');
        const utctime = k[0].headers.get('dicom-last-put-date');
        const date = utctime ? new Date(utctime) : new Date();
        const timeNow = new Date();
        const timeSincePut = timeNow - date;
        const millisecondsInDay = 8.64e7;
        if (lastViewed !== 'undefined' || timeSincePut > 7 * millisecondsInDay) {
          window.caches.delete(scope);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  public destroy() {
    eventTarget.removeEventListener(
      'CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR',
      this.handleQuotaExceededWriteError
    );
  }
}
