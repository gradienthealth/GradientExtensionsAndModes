import CropDisplayAreaService from './CropDisplayAreaService';

export default function CropDisplayAreaServiceWithServices(serviceManager) {
  return {
    name: 'CropDisplayAreaService',
    create: ({ configuration = {} }) => {
      return new CropDisplayAreaService(serviceManager);
    },
  }
};
