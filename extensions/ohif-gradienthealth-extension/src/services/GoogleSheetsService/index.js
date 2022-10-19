import GoogleSheetsService from './GoogleSheetsService.js';

export default function GoogleSheetsServiceWithServices(serviceManager) {
  return {
    name: 'GoogleSheetsService',
    create: ({ configuration = {} }) => {
      return new GoogleSheetsService(serviceManager);
    },
  }
};
