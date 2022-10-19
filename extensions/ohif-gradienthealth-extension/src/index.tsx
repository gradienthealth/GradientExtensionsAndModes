import getPanelModule from './getPanelModule';
import getViewportModule from './getViewportModule';
import getHangingProtocolModule from './getHangingProtocolModule';

import { id } from './id.js';
import GoogleSheetsService from './services/GoogleSheetsService';

console.log('gradienthealth', '@gradienthealth/ohif-gradienthealth-extension@0.0.2')
const gradientHealthExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,
  getHangingProtocolModule,
  getPanelModule,
  getViewportModule,
  getCommandsModule({ servicesManager }) {
    return {
      definitions: {
        setToolActive: {
          commandFn: ({ toolName, element }) => {
            if (!toolName) {
              console.warn('No toolname provided to setToolActive command');
            }

            // Set same tool or alt tool
            cornerstoneTools.setToolActiveForElement(element, toolName, {
              mouseButtonMask: 1,
            });
          },
          storeContexts: [],
          options: {},
        },
      },
      defaultContext: 'ACTIVE_VIEWPORT::TRACKED',
    };
  },
  preRegistration({ servicesManager }) {
    servicesManager.registerService(
      GoogleSheetsService(servicesManager)
    );
  },
};

export default gradientHealthExtension;
