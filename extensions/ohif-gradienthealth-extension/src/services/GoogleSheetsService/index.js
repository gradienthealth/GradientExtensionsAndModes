import GoogleSheetsService from './GoogleSheetsService.js';

export default function GoogleSheetsServiceWithServices(serviceManager, commandsManager, extensionManager) {
  return {
    name: 'GoogleSheetsService',
    create: ({ configuration = {} }) => {
      return new GoogleSheetsService(serviceManager, commandsManager, extensionManager);
    },
  }
};
