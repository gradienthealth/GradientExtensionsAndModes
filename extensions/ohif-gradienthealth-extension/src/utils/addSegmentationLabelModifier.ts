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

      const descriptionComponents = [
        displaySet.instances[0].ImageLaterality,
        displaySet.instances[0].ViewPosition,
        displaySet.SeriesDescription?.replace(/[/]/, ''),
      ];
      const newDescription = descriptionComponents
        .filter((variable) => variable !== undefined)
        .join('-');

      const segmentationsCount =
        segmentationService.getSegmentations(false).length;
      const increment = segmentationsCount > 0 ? ' ' + segmentationsCount : '';

      const label = `${newDescription} - Vessel ${increment}`;
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
