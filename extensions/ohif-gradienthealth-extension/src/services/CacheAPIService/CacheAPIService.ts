import { pubSubServiceInterface } from '@ohif/core';
// TODO this will be replaced by a TypeScript version in about 1 month
import { internal } from 'cornerstone-wado-image-loader';
import _cloneDeep from 'lodash.clonedeep';
import _ from 'lodash';

import {
  eventTarget,
  EVENTS,
  Enums,
  imageRetrievalPoolManager,
} from '@cornerstonejs/core';

const { getOptions, xhrRequest } = internal;

const LOCAL_EVENTS = {};

export default class CacheAPIService {
  listeners: { [key: string]: Function[] };
  EVENTS: { [key: string]: string };
  element: HTMLElement;
  private commandsManager;
  private extensionManager;
  private dataSource;
  private options;

  constructor(servicesManager, commandsManager, extensionManager) {
    Object.assign(this, pubSubServiceInterface);
    this.listeners = {};
    this.EVENTS = LOCAL_EVENTS;
    this.commandsManager = commandsManager;
    this.extensionManager = extensionManager;
  }

  public init() {
    // Need to add event listener if datasource changes
    const dataSources = this.extensionManager.getActiveDataSource();
    this.dataSource = dataSources[0];

    // Need to add event listener if the configuration changes
    this.options = Object.assign(_cloneDeep(getOptions()), {
      writeCache: true,
    });

    eventTarget.addEventListener(
      'CORNERSTONE_LOCALFORAGE_WRITE_FAILURE',
      this.handleLocalForageWriteError.bind(this)
    );
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

  public async getUrlsForStudyInstanceUID(StudyInstanceUID) {
    const series = await this.dataSource.getImageIdsForStudy(
      StudyInstanceUID
    );

    return _.flatten(series.map(s =>
      s.map(imageId => imageId.split(':').slice(1).join(':'))
    ));
  }

  public async getUrlsForStudyInstanceUIDs(StudyInstanceUIDs) {
    return _.flatten(await Promise.all(StudyInstanceUIDs.map(this.getUrlsForStudyInstanceUID.bind(this))))
  }

  public requestAndCacheUrl(url){
    const imageId = 'wadors:' + url
    imageRetrievalPoolManager.addRequest(
      xhrRequest.bind(
        null,
        url,
        imageId,
        {
          Accept: 'application/octet-stream',
        },
        {},
        this.options
      ),
      Enums.RequestType.Background,
      { imageId },
      0
    );
  }

  public requestAndCacheUrls(urls){
    const getScope = this.options.cache.getScope;
    const keys = _.uniq(urls.map((url)=> getScope({ url })))
    console.log('adding series to cache ', keys);
    urls.forEach(url => this.requestAndCacheUrl(url))
  }

  public async removeOldStudies(staleTime = 1 * 24 * 60 * 60 * 1000) {
    console.warn(
      'Removing studies older than ',
      staleTime / 1000 / 60 / 60 / 24,
      ' days'
    );
    const keys = await window?.localforage.keys();
    const values = await Promise.all(
      keys.map((key) => window?.localforage.getItem(key))
    );
    const zip = (a, b) => a.map((k, i) => [k, b[i]]);
    const keyValuePair = zip(keys, values);
    const oldStudies = keyValuePair.filter((ele) => {
      const [key, value] = ele;
      const ms = Date.now() - value.date;
      if (ms > staleTime) {
        return true;
      } else {
        return false;
      }
    });

    const promises = [];
    oldStudies.forEach((ele) => {
      const [key, value] = ele;
      promises.push(window?.caches.delete(key));
      promises.push(window?.localforage.removeItem(key));
    });
    return Promise.all(promises);
  }

  public async cacheStudyImageId(StudyInstanceUID) {
    const seriesImageIds = await this.dataSource.getImageIdsForStudy(
      StudyInstanceUID
    );
    seriesImageIds.map((imageIds) =>
      imageIds.map((imageId) => {
        const url = imageId.split(':').slice(1).join(':');
        imageRetrievalPoolManager.addRequest(
          xhrRequest.bind(
            null,
            url,
            imageId,
            {
              Accept: 'application/octet-stream',
            },
            {},
            this.options
          ),
          Enums.RequestType.Background,
          { imageId },
          0
        );
      })
    );
  }

  public async cacheMissingStudyImageIds(StudyInstanceUIDs) {
    const urls = await this.getUrlsForStudyInstanceUIDs(StudyInstanceUIDs);
    const getScope = this.options.cache.getScope;
    const isEqual = (a,b)=>{
      return getScope({url: a}) == b
    }
    const existingKeys = await window.caches.keys();
    this.requestAndCacheUrls(_.differenceWith(urls, existingKeys, isEqual));
  }

  public async removeCacheUrls(urls) {
    const getScope = this.options.cache.getScope;
    const keys = _.uniq(urls.map((url)=> getScope({ url })))
    console.log('delete series from cache ', keys);
    const promises = []
    keys.forEach(key=>{
      promises.push(window?.caches.delete(key));
      promises.push(window?.localforage.removeItem(key));
    })
    return Promise.all(promises);
  }

  public async removeStudyImageId(StudyInstanceUID) {
    const urls = await this.getUrlsForStudyInstanceUID(StudyInstanceUID)
    return this.removeCacheUrls(urls)
  }

  public async removeStudyImageIds(StudyInstanceUIDs) {
    const urls = await this.getUrlsForStudyInstanceUIDs(StudyInstanceUIDs)
    return this.removeCacheUrls(urls)
  }

  private async handleLocalForageWriteError(evt) {
    const { error, localforage, scopes } = evt.detail;
    console.warn(error);
    const existence = await scopes.map((scope) => localforage.getItem(scope)); // get keys which are partially saved
    const partiallySavedKeys = scopes.filter((ele, idx) => {
      if (existence[idx]) return true;
      return false;
    });

    const localForagePromises = partiallySavedKeys.map((scope) =>
      localforage.removeItem(scope)
    );
    const cacheAPIPromises = partiallySavedKeys.map((scope) =>
      window.caches.delete(scope)
    );
    return Promise.all([...localForagePromises, ...cacheAPIPromises]);
  }

  private async handleQuotaExceededWriteError(evt) {
    const { error, localforage, scope, cachePoolAPIManager, retry } =
      evt.detail;
    imageRetrievalPoolManager.clearRequestStack(Enums.RequestType.Background);
    await this.removeOldStudies();
    await window.caches.delete(scope); // delete any partially completed cache
    await cachePoolAPIManager.saveLocalForagePool(); // save the rest of the localforage pool
    return localforage.removeItem(scope); // remove the partially saved name scope
  }

  public destroy() {
    eventTarget.removeEventListener(
      'CORNERSTONE_LOCALFORAGE_WRITE_FAILURE',
      this.handleLocalForageWriteError
    );
    eventTarget.removeEventListener(
      'CORNERSTONE_CACHE_QUOTA_EXCEEDED_ERROR',
      this.handleQuotaExceededWriteError
    );
  }
}
