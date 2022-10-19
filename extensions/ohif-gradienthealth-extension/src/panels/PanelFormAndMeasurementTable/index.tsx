import React from 'react';
import PanelForm from '../PanelForm'
import PanelMeasurementTableTracking from '../PanelMeasurementTableTracking';
import PropTypes from 'prop-types';
import Divider from '@mui/material/Divider';

function PanelFormAndMeasurementTable({ servicesManager, extensionManager }) {
    return (
      <React.Fragment>
          <div style={{height: "150px", overflowY: "auto"}}>
            <PanelMeasurementTableTracking servicesManager={servicesManager} extensionManager={extensionManager}/>
          </div>
          <div className="m-2">
            <Divider style={{background: "white"}}/>
          </div>
          <PanelForm servicesManager={servicesManager} extensionManager={extensionManager}/>
      </React.Fragment>
    )
}

PanelFormAndMeasurementTable.propTypes = {
  servicesManager: PropTypes.shape({
    services: PropTypes.shape({
    }).isRequired,
  }).isRequired,
};

export default PanelFormAndMeasurementTable;
