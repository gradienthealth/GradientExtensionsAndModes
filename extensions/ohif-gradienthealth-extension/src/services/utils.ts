// @ts-ignore
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

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

export const removePreviousFilesArraybuffer = (
  studyInstanceUID: string,
  servicesManager: Record<string, any>
) => {
  const { displaySetService } = servicesManager.services;
  const studyDisplaySets = displaySetService.getDisplaySetsBy(
    (ds) => ds.StudyInstanceUID === studyInstanceUID
  );
  const urls = studyDisplaySets.flatMap((displaySet) =>
    displaySet.instances.reduce((imageIds, instance) => {
      const handledUrl = instance.imageId.split(
        /dicomweb:|dicomtar:|dicomzip:/
      )[1];
      return [...imageIds, ...(handledUrl ? [handledUrl] : [])];
    }, [])
  );

  const fileUrls = new Set<string>();
  for (const url of urls) {
    // Handles .tar files
    const urlParts = url.split('.tar');

    if (urlParts.length > 1) {
      fileUrls.add(urlParts[0] + '.tar');
    }
  }

  fileUrls.forEach((fileUrl) => {
    if (fileUrl.includes('.tar')) {
      try {
        dicomImageLoader.wadors.tarFileManager.remove(fileUrl);
      } catch (error) {
        console.warn(error);
      }
    }
  });
};
