import hotkeys from './hotkeyBindings.js';
import toolbarButtons from './toolbarButtons.js';
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
        ToolBarService, 
        ToolGroupService, 
        GoogleSheetsService, 
        CropDisplayAreaService
      } = servicesManager.services;

      GoogleSheetsService.init();
      CropDisplayAreaService.init();

      // Init Default and SR ToolGroups
      initToolGroups(extensionManager, ToolGroupService, commandsManager);

      let unsubscribe;

      const activateTool = () => {
        ToolBarService.recordInteraction({
          groupId: 'WindowLevel',
          itemId: 'WindowLevel',
          interactionType: 'tool',
          commands: [
            {
              commandName: 'setToolActive',
              commandOptions: {
                toolName: 'WindowLevel',
              },
              context: 'CORNERSTONE',
            },
          ],
        });

        // We don't need to reset the active tool whenever a viewport is getting
        // added to the toolGroup.
        unsubscribe();
      };

      // Since we only have one viewport for the basic cs3d mode and it has
      // only one hanging protocol, we can just use the first viewport
      ({ unsubscribe } = ToolGroupService.subscribe(
        ToolGroupService.EVENTS.VIEWPORT_ADDED,
        activateTool
      ));

      ToolBarService.init(extensionManager);
      ToolBarService.addButtons(toolbarButtons);
      ToolBarService.createButtonSection('primary', [
        'Zoom',
        'WindowLevel',
        'Pan',
        'Layout',
        'MoreTools',
      ]);
    },
    onModeExit: ({ servicesManager }) => {
      const {
        ToolGroupService,
        SyncGroupService,
        MeasurementService,
        ToolBarService,
        GoogleSheetsService,
      } = servicesManager.services;
      ToolBarService.reset();
      MeasurementService.clearMeasurements();
      ToolGroupService.destroy();
      SyncGroupService.destroy();
      GoogleSheetsService.destroy();
    },
    validationTags: {
      study: [],
      series: [],
    },
    isValidMode: ({ modalities }) => {
      const modalities_list = modalities.split('\\');

      // Slide Microscopy modality not supported by basic mode yet
      return !modalities_list.includes('SM');
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
              leftPanelDefaultClosed: true,
              rightPanelDefaultClosed: false,
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
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
