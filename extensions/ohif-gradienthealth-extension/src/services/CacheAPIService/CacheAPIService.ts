import { DicomMetadataStore, pubSubServiceInterface } from '@ohif/core';
import { internal, wadouri } from '@cornerstonejs/dicom-image-loader';
const { getOptions } = internal;
import _ from 'lodash';
import {
  eventTarget,
  EVENTS,
  Enums,
  imageLoader,
  imageLoadPoolManager,
} from '@cornerstonejs/core';

const LOCAL_EVENTS = {
  IMAGE_CACHE_PREFETCHED: 'event::gradienthealth::image_cache_prefetched',
};

export default class CacheAPIService {
  listeners: { [key: string]: Function[] };
  EVENTS: { [key: string]: string };
  element: HTMLElement;
  private servicesManager;
  private commandsManager;
  private extensionManager;
  private dataSource;
  private options;
  public storageUsage;
  public storageQuota;
  private imageIdToFileUriMap;

  constructor(servicesManager, commandsManager, extensionManager) {
    this.listeners = {};
    this.EVENTS = LOCAL_EVENTS;
    this.commandsManager = commandsManager;
    this.extensionManager = extensionManager;
    this.servicesManager = servicesManager;
    this.storageUsage = null;
    this.storageQuota = null;
    this.imageIdToFileUriMap = new Map();
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

  public async cacheStudy(StudyInstanceUID, buckets = undefined) {
    const segSOPClassUIDs = ['1.2.840.10008.5.1.4.1.1.66.4'];
    await this.dataSource.retrieve.series.metadata({
      StudyInstanceUID,
      buckets,
    });
    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    const imageIds = study.series
      .filter(
        (serie) => !segSOPClassUIDs.includes(serie.instances[0].SOPClassUID)
      )
      .flatMap((serie) =>
        serie.instances.flatMap((instance) => instance.imageId)
      );
    await Promise.all([
      this.cacheImageIds(imageIds),
      this.cacheSegFiles(StudyInstanceUID),
    ]);
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

  public async cacheImageIds(imageIds) {
    const promises: any[] = [];
    
    function sendRequest(imageId, options) {
      const promise = imageLoader.loadAndCacheImage(imageId, options);
      promises.push(promise);

      return promise.then(
        (imageLoadObject) => {
          this._broadcastEvent(this.EVENTS.IMAGE_CACHE_PREFETCHED, { imageLoadObject });
        },
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

    await Promise.all(promises)
  }

  public async cacheSegFiles(studyInstanceUID) {
    const segSOPClassUIDs = ['1.2.840.10008.5.1.4.1.1.66.4'];
    const { displaySetService, userAuthenticationService } =
      this.servicesManager.services;

    const study = DicomMetadataStore.getStudy(studyInstanceUID);
    const headers = userAuthenticationService.getAuthorizationHeader();
    const promises = study.series.map((serie) => {
      const { SOPClassUID, SeriesInstanceUID, url } = serie.instances[0];
      if (segSOPClassUIDs.includes(SOPClassUID)) {
        const { scheme, url: parsedUrl } = wadouri.parseImageId(url);
        if (scheme === 'dicomzip') {
          return wadouri.loadZipRequest(parsedUrl, url);
        }

        const displaySet =
          displaySetService.getDisplaySetsForSeries(SeriesInstanceUID)[0];

        if (this.imageIdToFileUriMap.get(url) === displaySet.instance.imageId) {
          return;
        }

        return fetch(parsedUrl, { headers })
          .then((response) => response.arrayBuffer())
          .then((buffer) => wadouri.fileManager.add(new Blob([buffer])))
          .then((fileUri) => {
            this.imageIdToFileUriMap.set(url, fileUri);
            displaySet.instance.imageId = fileUri;
            displaySet.instance.getImageId = () => fileUri;
          });
      }
    });

    await Promise.all(promises);
  }

  public updateCachedFile(blob, displaySet) {
    const { url, imageId } = displaySet.instances[0];
    const fileUri = wadouri.fileManager.add(blob);
    displaySet.instance.imageId = fileUri;
    displaySet.instance.getImageId = () => fileUri;
    this.imageIdToFileUriMap.set(url, fileUri);

    if (imageId?.startsWith('dicomfile:')) {
      const { url: index } = wadouri.parseImageId(imageId);
      wadouri.fileManager.remove(index);
    }
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
