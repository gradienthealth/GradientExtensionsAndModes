import CacheAPIService from './CacheAPIService';

export default function ExtendedCacheAPIService(servicesManager, commandsManager, extensionManager) {
  return {
    name: 'CacheAPIService',
    create: ({ configuration = {} }) => {
      return new CacheAPIService(servicesManager, commandsManager, extensionManager);
    },
  };
}
