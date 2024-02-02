export const getSegDisplaysetsOfReferencedImagesIds = (
  imageIds: string[] = [],
  displaySetService: any
) => {
  const loadedDisplaySet = displaySetService.getDisplaySetsBy((ds) =>
    ds.images?.find((image) => imageIds.includes(image.imageId))
  )?.[0];

  const referencedSeriesInstanceUID = loadedDisplaySet.SeriesInstanceUID;
  return displaySetService.getDisplaySetsBy(
    (ds) => ds.referencedSeriesInstanceUID === referencedSeriesInstanceUID
  );
};
