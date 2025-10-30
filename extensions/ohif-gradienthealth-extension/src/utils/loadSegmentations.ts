import { eventTarget, Enums, cache } from '@cornerstonejs/core';

export function addLoadSegmentationsListener(servicesManager) {
  eventTarget.addEventListener(Enums.Events.ELEMENT_ENABLED, (evt) => {
    evt.detail.element.removeEventListener(
      Enums.Events.VIEWPORT_NEW_IMAGE_SET,
      (evt) => loadSegmentations(servicesManager, evt.detail.viewportId)
    );
    evt.detail.element.addEventListener(
      Enums.Events.VIEWPORT_NEW_IMAGE_SET,
      (evt) => loadSegmentations(servicesManager, evt.detail.viewportId)
    );
  });
}

function loadSegmentations(
  serviceManager: {
    services: {
      segmentationService: any;
      displaySetService: any;
      UserAuthenticationService: any;
      CacheAPIService: any;
      viewportGridService: any;
    };
  },
  viewportId: string
) {
  const params = new URLSearchParams(window.location.search);
  const studyInstanceUID = params.get('StudyInstanceUIDs');

  const segSOPClassUIDs = ['1.2.840.10008.5.1.4.1.1.66.4'];
  const {
    segmentationService,
    displaySetService,
    UserAuthenticationService,
    CacheAPIService,
    viewportGridService,
  } = serviceManager.services;
  const headers = UserAuthenticationService.getAuthorizationHeader();
  const viewport = viewportGridService.getViewportState(viewportId);

  // TODO: need to filter the displaysets to the series loaded in the viewport
  const viewportSegDisplaySets = displaySetService.getDisplaySetsBy(
    (ds: {
      StudyInstanceUID: any;
      SOPClassUID: string;
      referencedDisplaySetInstanceUID: string;
    }) =>
      ds.StudyInstanceUID === studyInstanceUID &&
      segSOPClassUIDs.includes(ds.SOPClassUID) &&
      viewport.displaySetInstanceUIDs.includes(
        ds.referencedDisplaySetInstanceUID
      )
  );
  const nonSegImageIds = displaySetService
    .getDisplaySetsBy(
      (ds: { StudyInstanceUID: any; SOPClassUID: string }) =>
        ds.StudyInstanceUID === studyInstanceUID &&
        !segSOPClassUIDs.includes(ds.SOPClassUID)
    )
    .flatMap((ds: { images: any[] }) =>
      ds.images.flatMap((image: { imageId: any }) => image.imageId)
    );

  const isAllSegmentationsLoaded = viewportSegDisplaySets.every(
    (ds: { isLoaded: boolean }) => ds.isLoaded
  );

  if (isAllSegmentationsLoaded) {
    return;
  }

  const isAllSeriesOfStudyCached = () => {
    return nonSegImageIds.every((imageId: any) =>
      cache.getImageLoadObject(imageId)
    );
  };

  let unsubscribe: () => void;

  const loadSegmentations = async () => {
    if (isAllSeriesOfStudyCached()) {
      const loadPromises = viewportSegDisplaySets.map(
        async (displaySet: {
          getReferenceDisplaySet: () => void;
          load: (arg0: { headers: any }) => any;
        }) => {
          //   displaySet.getReferenceDisplaySet();
          return displaySet.load({ headers });
        }
      );

      await Promise.all(loadPromises);

      const addRepresentationPromises = viewportSegDisplaySets.map(
        async (displaySet: { displaySetInstanceUID: string }) =>
          await segmentationService.addSegmentationRepresentation(viewportId, {
            segmentationId: displaySet.displaySetInstanceUID,
          })
      );

      Promise.all(addRepresentationPromises).then(() => {
        const segmentationsOfLoadedImage = displaySetService.getDisplaySetsBy(
          (ds: { referencedDisplaySetInstanceUID: string }) =>
            ds.referencedDisplaySetInstanceUID ===
            viewport.displaySetInstanceUIDs[0]
        );

        // we are setting first segmentation of the image in the active viewport as active.
        segmentationService.setActiveSegmentation(
          viewportId,
          segmentationsOfLoadedImage[0].displaySetInstanceUID
        );
      });

      unsubscribe?.();
    }
  };

  if (isAllSeriesOfStudyCached()) {
    loadSegmentations();
  } else {
    ({ unsubscribe } = CacheAPIService.subscribe(
      CacheAPIService.EVENTS.IMAGE_CACHE_PREFETCHED,
      loadSegmentations
    ));
  }
}
