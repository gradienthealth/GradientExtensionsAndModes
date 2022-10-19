import { DicomMetadataStore } from '@ohif/core';

/**
 * Initialize the route.
 *
 * @param props.servicesManager to read services from
 * @param props.studyInstanceUIDs for a list of studies to read
 * @param props.dataSource to read the data from
 * @returns array of subscriptions to cancel
 */
 function defaultRouteInit(
    { servicesManager, studyInstanceUIDs, dataSource },
    hangingProtocol
  ) {
    const {
      DisplaySetService,
      HangingProtocolService,
    } = servicesManager.services;
  
    const unsubscriptions = [];
    const {
      unsubscribe: instanceAddedUnsubscribe,
    } = DicomMetadataStore.subscribe(
      DicomMetadataStore.EVENTS.INSTANCES_ADDED,
      function({ StudyInstanceUID, SeriesInstanceUID, madeInClient = false }) {
        const seriesMetadata = DicomMetadataStore.getSeries(
          StudyInstanceUID,
          SeriesInstanceUID
        );
  
        DisplaySetService.makeDisplaySets(seriesMetadata.instances, madeInClient);
      }
    );
  
    unsubscriptions.push(instanceAddedUnsubscribe);
  
    const allRetrieves = studyInstanceUIDs.map(StudyInstanceUID =>
      dataSource.retrieve.series.metadata({ StudyInstanceUID })
    );
  
    // The hanging protocol matching service is fairly expensive to run multiple
    // times, and doesn't allow partial matches to be made (it will simply fail
    // to display anything if a required match fails), so we wait here until all metadata
    // is retrieved (which will synchronously trigger the display set creation)
    // until we run the hanging protocol matching service.
  
    Promise.allSettled(allRetrieves).then(() => {
      const displaySets = DisplaySetService.getActiveDisplaySets();
  
      if (!displaySets || !displaySets.length) {
        return;
      }
  
      const studyMap = {};
  
      // Prior studies don't quite work properly yet, but the studies list
      // is at least being generated and passed in.
      const studies = displaySets.reduce((prev, curr) => {
        const { StudyInstanceUID } = curr;
        if (!studyMap[StudyInstanceUID]) {
          const study = DicomMetadataStore.getStudy(StudyInstanceUID);
          studyMap[StudyInstanceUID] = study;
          prev.push(study);
        }
        return prev;
      }, []);
  
      // The assumption is that the display set at position 0 is the first
      // study being displayed, and is thus the "active" study.
      const activeStudy = studies[0];
  
      // run the hanging protocol matching on the displaySets with the predefined
      // hanging protocol in the mode configuration
      HangingProtocolService.run(
        { studies, activeStudy, displaySets },
        hangingProtocol
      );
    });
  
    return unsubscriptions;
  }

export default defaultRouteInit;
