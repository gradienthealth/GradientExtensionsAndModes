function requestDisplaySetCreationForStudy(
  dataSource,
  displaySetService,
  StudyInstanceUID: string,
  madeInClient: boolean
) {
  if (
    displaySetService.activeDisplaySets.some(
      (displaySet) => displaySet.StudyInstanceUID === StudyInstanceUID
    )
  ) {
    return;
  }

  dataSource.retrieve.series.metadata({ StudyInstanceUID, madeInClient });
}

export default requestDisplaySetCreationForStudy;
