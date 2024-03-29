import getPanelModule from './getPanelModule';
import getViewportModule from './getViewportModule';
import getHangingProtocolModule from './getHangingProtocolModule';

import { id } from './id.js';
import GoogleSheetsService from './services/GoogleSheetsService';
import CropDisplayAreaService from './services/CropDisplayAreaService';
import CacheAPIService from './services/CacheAPIService';

// import { CornerstoneEventTarget } from '@cornerstonejs/core/CornerstoneEventTarget';
// import { Events } from '@cornerstonejs/core/Events';

console.log('gradienthealth', '@gradienthealth/ohif-gradienthealth-extension@0.3.0')
const gradientHealthExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,
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
};

export default gradientHealthExtension;
