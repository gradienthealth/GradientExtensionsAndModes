import hotkeys from './hotkeyBindings.js';
import toolbarButtons from './toolbarButtons.js';
import { id } from './id.js';
import initToolGroups from './initToolGroups.js';
import { DicomMetadataStore } from '@ohif/core';

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  hangingProtocols: '@ohif/extension-default.hangingProtocolModule.default',
};

const gradienthealth = {
  measurementsAndMeasurements: 'gradienthealth.panelModule.form-and-measurements',
  thumbnailList: 'gradienthealth.panelModule.seriesList',
  viewport: 'gradienthealth.viewportModule.cornerstone-gradient',
  hangingProtocols: 'gradienthealth.hangingProtocolModule.default',
};

const tracked = {
  measurements:
    '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport:
    '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
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

async function customRouteInit({
  servicesManager,
  studyInstanceUIDs,
  dataSource,
}) {
  const {
    DisplaySetService,
    HangingProtocolService,
  } = servicesManager.services;

  const unsubscriptions = [];
  const {
    unsubscribe: instanceAddedUnsubscribe,
  } = DicomMetadataStore.subscribe(
    DicomMetadataStore.EVENTS.INSTANCES_ADDED,
    ({ StudyInstanceUID, SeriesInstanceUID, madeInClient = false }) => {
      const seriesMetadata = DicomMetadataStore.getSeries(
        StudyInstanceUID,
        SeriesInstanceUID
      );
      DisplaySetService.makeDisplaySets(seriesMetadata.instances, madeInClient);

      const studyMetadata = DicomMetadataStore.getStudy(StudyInstanceUID);
      if (!madeInClient) {
        HangingProtocolService.run(studyMetadata);
      }
    }
  );

  unsubscriptions.push(instanceAddedUnsubscribe);
  
  studyInstanceUIDs.forEach(StudyInstanceUID => {
    dataSource.retrieve.series.metadata({ StudyInstanceUID });
  });

  return unsubscriptions;
}

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
    routeName: 'ngt_contour',
    displayName: 'Nasogastric Tube Contour',
    onModeEnter: ({ servicesManager, extensionManager, commandsManager }) => {
      const { ToolBarService, ToolGroupService, GoogleSheetsService } = servicesManager.services;

      GoogleSheetsService.init();

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
        'MeasurementTools',
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
      } = servicesManager.services;

      ToolBarService.reset();
      MeasurementService.clearMeasurements();
      ToolGroupService.destroy();
      SyncGroupService.destroy();
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
        path: 'ngt',
        init: customRouteInit,
        layoutTemplate: ({ location, servicesManager }) => {
          return {
            id: ohif.layout,
            props: {
              leftPanels: [gradienthealth.thumbnailList],
              rightPanels: [gradienthealth.measurementsAndMeasurements],
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
    hangingProtocols: [ohif.hangingProtocols],
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
