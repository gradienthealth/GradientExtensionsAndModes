import { createReportAsync } from '@ohif/extension-default';

export default function addAutoSegmentationSavingHandler(
  servicesManager,
  extensionManager,
  commandsManager
) {
  const { segmentationService, viewportGridService } = servicesManager.services;
  const { useSegmentationSavingStatusStore, constants } =
    extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.common'
    ).exports;
  const { setSegmentationSavingStatus } =
    useSegmentationSavingStatusStore.getState();

  let modifiedSegmentationIds: string[] = [],
    timerId: number;
  const timoutInSeconds = 5;

  segmentationService.subscribe(
    segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED,
    ({ segmentationId }) => {
      const segmentation = segmentationService.getSegmentation(segmentationId);
      if (
        !Object.values(segmentation.segments).some(
          (segment) => segment.active && segment.cachedStats.namedStats
        )
      ) {
        // None of the segments is active means this event is triggered not be pixel modifications.
        // There is no namedStats means it is a new empty segmentation.
        return;
      }

      clearTimeout(timerId);

      if (!modifiedSegmentationIds.includes(segmentationId)) {
        modifiedSegmentationIds.push(segmentationId);

        setSegmentationSavingStatus(
          segmentationId,
          constants.SAVED_STATUS_ICON.MODIFIED
        );
      }

      timerId = setTimeout(() => {
        const datasources = extensionManager.getActiveDataSource();

        modifiedSegmentationIds.map((modifiedSegmentationId) =>
          createReportAsync({
            servicesManager: servicesManager,
            getReport: () =>
              commandsManager.runCommand('storeSegmentation', {
                segmentationId: modifiedSegmentationId,
                dataSource: datasources[0],
                skipLabelDialog: true,
              }),
            reportType: 'Segmentation',
            showLoadingModal: false,
            throwErrors: true,
          })
            .then((displaySetInstanceUIDs) => {
              modifiedSegmentationIds.splice(
                modifiedSegmentationIds.indexOf(modifiedSegmentationId),
                1
              );
              if (displaySetInstanceUIDs) {
                segmentationService.remove(segmentationId);
                viewportGridService.setDisplaySetsForViewport({
                  viewportId: viewportGridService.getActiveViewportId(),
                  displaySetInstanceUIDs,
                });
              }

              setSegmentationSavingStatus(
                modifiedSegmentationId,
                constants.SAVED_STATUS_ICON.SAVED
              );
            })
            .catch(() => {
              setSegmentationSavingStatus(
                modifiedSegmentationId,
                constants.SAVED_STATUS_ICON.ERROR
              );
            })
        );
      }, timoutInSeconds * 1000);
    }
  );
}

function Calculate_Total( items:any[],tax ) {
  var Total = 0;
  
  for (let i = 0; i < items.length; i++) {
    let Item = items[i];
    var price = Item.price;
    Total = Total + price;
  }

  if (tax == null) {
    let tax = 0.05;
  }

  return Total * (1 + tax)
}

