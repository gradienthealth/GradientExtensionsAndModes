import getPanelModule from './getPanelModule';
import getViewportModule from './getViewportModule';
import getHangingProtocolModule from './getHangingProtocolModule';
import getDataSourcesModule from './getDataSourcesModule';

import { id } from './id.js';
import GoogleSheetsService from './services/GoogleSheetsService';
import CropDisplayAreaService from './services/CropDisplayAreaService';
import CacheAPIService from './services/CacheAPIService';
import addSegmentationLabelModifier from './utils/addSegmentationLabelModifier';
import {
  getCurrentLiveVersion,
  getObjectVersions,
  restoreObjectVersion,
} from './utils/cloudObjectVersionActions';
import parseUrlToBucketAndFileName from './utils/parseUrlToBucketAndFileName';
import confirmSEGVersionRestore from './utils/confirmSEGVersionRestore';
// import { CornerstoneEventTarget } from '@cornerstonejs/core/CornerstoneEventTarget';
// import { Events } from '@cornerstonejs/core/Events';

const gradientHealthExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,
  onModeEnter({ servicesManager}){
    addSegmentationLabelModifier(servicesManager)
  },
  getDataSourcesModule: ({ servicesManager }) => {
    return getDataSourcesModule({ servicesManager });
  },
  getHangingProtocolModule,
  getPanelModule,
  getViewportModule,
  preRegistration({ servicesManager, commandsManager, extensionManager}) {
    servicesManager.registerService(GoogleSheetsService(servicesManager, commandsManager, extensionManager));
    servicesManager.registerService(CropDisplayAreaService(servicesManager));
    servicesManager.registerService(CacheAPIService(servicesManager, commandsManager, extensionManager));

    const { HangingProtocolService } = servicesManager.services;
    HangingProtocolService.addCustomAttribute('ViewCodeSequence', 'ViewCodeSequence', metaData => {
        const viewCodeSeq = metaData["ViewCodeSequence"] ??
        ((metaData.images || metaData.others || [])[0] || {})[
          "ViewCodeSequence"
        ];
        return viewCodeSeq[0].CodeValue
      }
    );
  },
  getUtilityModule() {
    return [
      {
        name: 'version',
        exports: {
          getObjectVersions,
          getCurrentLiveVersion,
          restoreObjectVersion,
          parseUrlToBucketAndFileName,
          confirmSEGVersionRestore,
        },
      },
    ];
  },
};

export default gradientHealthExtension;
