import React from 'react';
import PropTypes from 'prop-types';

import PanelStudyBrowserTracking from './PanelStudyBrowserTracking';
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
function WrappedPanelStudyBrowserTracking({
  commandsManager,
  extensionManager,
  servicesManager,
}) {
  const dataSource = extensionManager.getActiveDataSource()[0];

  const _getStudiesForPatientByMRN = getStudyForPatientUtility(
    extensionManager,
    dataSource
  );
  const _getImageSrcFromImageId =
    createGetImageSrcFromImageIdFn(extensionManager);
  const _requestDisplaySetCreationForStudy =
    createRequestDisplaySetcreationFn(dataSource);

  return (
    <PanelStudyBrowserTracking
      MeasurementService={servicesManager.services.MeasurementService}
      DisplaySetService={servicesManager.services.DisplaySetService}
      UIDialogService={servicesManager.services.UIDialogService}
      UINotificationService={servicesManager.services.UINotificationService}
      dataSource={dataSource}
      getImageSrc={_getImageSrcFromImageId}
      getStudiesForPatientByMRN={_getStudiesForPatientByMRN}
      requestDisplaySetCreationForStudy={_requestDisplaySetCreationForStudy}
    />
  );
}

WrappedPanelStudyBrowserTracking.propTypes = {
  commandsManager: PropTypes.object.isRequired,
  extensionManager: PropTypes.object.isRequired,
  servicesManager: PropTypes.object.isRequired,
};

export default WrappedPanelStudyBrowserTracking;
