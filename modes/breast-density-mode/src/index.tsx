import hotkeys from './hotkeyBindings.js';
import toolbarButtons from './toolbarButtons.js';
import moreTools from './moreTools.ts';
import { id } from './id.js';
import initToolGroups from './initToolGroups.js';

console.log('gradienthealth', '@gradienthealth/breast-density-mode:0.0.2')
const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  hangingProtocols: '@ohif/extension-default.hangingProtocolModule.default',
};

const gradienthealth = {
  form: '@gradienthealth/ohif-gradienthealth-extension.panelModule.form',
  measurements: '@gradienthealth/ohif-gradienthealth-extension.panelModule.measurements',
  thumbnailList: '@gradienthealth/ohif-gradienthealth-extension.panelModule.seriesList',
  viewport: '@gradienthealth/ohif-gradienthealth-extension.viewportModule.cornerstone-gradient',
  hangingProtocols: '@gradienthealth/ohif-gradienthealth-extension.hangingProtocolModule.breast',
};

const dicomsr = {
  sopClassHandler:
    '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr',
  viewport: '@ohif/extension-cornerstone-dicom-sr.viewportModule.dicom-sr',
};

const dicomvideo = {
  sopClassHandler:
    '@ohif/extension-dicom-video.sopClassHandlerModule.dicom-video',
  viewport: '@ohif/extension-dicom-video.viewportModule.dicom-video',
};

const dicompdf = {
  sopClassHandler: '@ohif/extension-dicom-pdf.sopClassHandlerModule.dicom-pdf',
  viewport: '@ohif/extension-dicom-pdf.viewportModule.dicom-pdf',
};

const extensionDependencies = {
  // Can derive the versions at least process.env.from npm_package_version
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-sr': '^3.0.0',
  '@ohif/extension-dicom-pdf': '^3.0.1',
  '@ohif/extension-dicom-video': '^3.0.1',
};

function modeFactory({ modeConfiguration }) {
  let _activatePanelTriggersSubscriptions = [];
  return {
    // TODO: We're using this as a route segment
    // We should not be.
    id,
    routeName: 'breast_density',
    displayName: 'Breast Density Viewer',
    /**
     * Lifecycle hooks
     */
    onModeEnter: ({ servicesManager, extensionManager, commandsManager }) => {
      const { 
        toolbarService, 
        toolGroupService, 
        GoogleSheetsService, 
        CropDisplayAreaService,
        CacheAPIService,
        measurementService
      } = servicesManager.services;

      measurementService.clearMeasurements();

      // Init Default and SR ToolGroups
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      GoogleSheetsService.init();
      CropDisplayAreaService.init();
      CacheAPIService.init();
      toolbarService.addButtons([...toolbarButtons, ...moreTools]);
      toolbarService.createButtonSection('primary', [
        'Zoom',
        'WindowLevel',
        'Pan',
        'Layout',
        'MoreTools',
      ]);
    },
    onModeExit: ({ servicesManager }) => {
      const {
        toolGroupService,
        SyncGroupService,
        measurementService,
        toolbarService,
        GoogleSheetsService,
        CacheAPIService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      _activatePanelTriggersSubscriptions.forEach(sub => sub.unsubscribe());
      _activatePanelTriggersSubscriptions = [];

      uiDialogService.dismissAll();
      uiModalService.hide();
      toolbarService.reset();
      measurementService.clearMeasurements();
      toolGroupService.destroy();
      SyncGroupService.destroy();
      GoogleSheetsService.destroy();
      CacheAPIService.destroy();
      cornerstoneViewportService.destroy();
    },
    validationTags: {
      study: [],
      series: [],
    },
    isValidMode: ({ modalities }) => {
      const modalities_list = modalities.split('\\');

      // Slide Microscopy modality not supported by basic mode yet
      return {
        valid: !modalities_list.includes('SM'),
        description:
          'The mode does not support studies that ONLY include the following modalities: SM',
      };
    },
    routes: [
      {
        path: 'breast',
        layoutTemplate: ({ location, servicesManager }) => {
          const params = new URLSearchParams(location.search)
          const rightPanels = params.get('sheetId') ? [gradienthealth.form] : []
          return {
            id: ohif.layout,
            props: {
              leftPanels: [gradienthealth.thumbnailList],
              rightPanels: rightPanels,
              leftPanelClosed: true,
              rightPanelClosed: false,
              viewports: [
                {
                  namespace: gradienthealth.viewport,
                  displaySetsToDisplay: [ohif.sopClassHandler],
                },
                {
                  namespace: dicomsr.viewport,
                  displaySetsToDisplay: [dicomsr.sopClassHandler],
                },
                {
                  namespace: dicomvideo.viewport,
                  displaySetsToDisplay: [dicomvideo.sopClassHandler],
                },
                {
                  namespace: dicompdf.viewport,
                  displaySetsToDisplay: [dicompdf.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],
    extensions: extensionDependencies,
    hangingProtocol: 'breast',
    // Order is important in sop class handlers when two handlers both use
    // the same sop class under different situations.  In that case, the more
    // general handler needs to come last.  For this case, the dicomvideo must
    // come first to remove video transfer syntax before ohif uses images
    sopClassHandlers: [
      dicomvideo.sopClassHandler,
      ohif.sopClassHandler,
      dicompdf.sopClassHandler,
      dicomsr.sopClassHandler,
    ],
    hotkeys: [...hotkeys],
    ...modeConfiguration
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
export { initToolGroups, moreTools, toolbarButtons };
