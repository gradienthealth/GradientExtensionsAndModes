const addSegmentationLabelModifier = (servicesManager) => {
  const { segmentationService, displaySetService } = servicesManager.services;

  segmentationService.subscribe(
    segmentationService.EVENTS.SEGMENTATION_ADDED,
    ({ segmentation }) => {
      let displaySet = displaySetService.getDisplaySetByUID(
        segmentation.displaySetInstanceUID
      );

      if (displaySet.Modality === 'SEG') {
        return;
      }

      const segmentationsCount = segmentationService.getSegmentations(false).length;
      const increment = segmentationsCount > 0 ? ' ' + segmentationsCount : '';

      const label = displaySet.SeriesDescription + ' - Vessel' + increment;
      segmentation.label = label;

      segmentationService.addOrUpdateSegmentation(
        segmentation,
        false, // suppress event
        true // notYetUpdatedAtSource
      );
    }
  );
};

export default addSegmentationLabelModifier;
