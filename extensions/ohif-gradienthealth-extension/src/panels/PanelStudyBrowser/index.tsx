import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import PanelStudyBrowser from './PanelStudyBrowser';
import { studyPanelUtilities } from '../utils';

const {
  createGetImageSrcFromImageIdFn,
  createRequestDisplaySetcreationFn,
  getStudyForPatientUtility,
} = studyPanelUtilities;

/**
 * Wraps the PanelStudyBrowser and provides features afforded by managers/services
 *
 * @param {object} params
 * @param {object} commandsManager
 * @param {object} extensionManager
 */
function WrappedPanelStudyBrowser({
  commandsManager,
  extensionManager,
  servicesManager,
}) {
  // TODO: This should be made available a different way; route should have
  // already determined our datasource
  const dataSource = extensionManager.getDataSources()[0];
  const _getStudiesForPatientByMRN = getStudyForPatientUtility(
    extensionManager,
    dataSource
  );
  const _getImageSrcFromImageId = useCallback(
    createGetImageSrcFromImageIdFn(extensionManager),
    []
  );
  const _requestDisplaySetCreationForStudy =
    createRequestDisplaySetcreationFn(dataSource);

  return (
    <PanelStudyBrowser
      servicesManager={servicesManager}
      dataSource={dataSource}
      getImageSrc={_getImageSrcFromImageId}
      getStudiesForPatientByMRN={_getStudiesForPatientByMRN}
      requestDisplaySetCreationForStudy={_requestDisplaySetCreationForStudy}
    />
  );
}

WrappedPanelStudyBrowser.propTypes = {
  commandsManager: PropTypes.object.isRequired,
  extensionManager: PropTypes.object.isRequired,
  servicesManager: PropTypes.object.isRequired,
};

export default WrappedPanelStudyBrowser;
