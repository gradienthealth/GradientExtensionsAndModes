import getImageSrcFromImageId from './getImageSrcFromImageId';
import requestDisplaySetCreationForStudy from './requestDisplaySetCreationForStudy';

export function createGetImageSrcFromImageIdFn(extensionManager) {
  const utilities = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.utilityModule.common'
  );

  try {
    const { cornerstone } = utilities.exports.getCornerstoneLibraries();
    return getImageSrcFromImageId.bind(null, cornerstone);
  } catch (ex) {
    throw new Error('Required command not found');
  }
}

export function getStudyForPatientUtility(extensionManager, datasource) {
  const utilityModule = extensionManager.getModuleEntry(
    '@ohif/extension-default.utilityModule.common'
  );

  const { getStudiesForPatientByMRN } = utilityModule.exports;
  return getStudiesForPatientByMRN.bind(null, datasource);
}

export function createRequestDisplaySetcreationFn(datasource) {
  return requestDisplaySetCreationForStudy.bind(null, datasource);
}
