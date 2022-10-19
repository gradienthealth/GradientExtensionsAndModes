import {
  PanelMeasurementTableTracking,
  PanelStudyBrowserTracking,
  PanelForm,
  PanelFormAndMeasurementTable
} from './panels';

// TODO:
// - No loading UI exists yet
// - cancel promises when component is destroyed
// - show errors in UI for thumbnails if promise fails
function getPanelModule({
  commandsManager,
  extensionManager,
  servicesManager,
}) {
  return [
    {
      name: 'seriesList',
      iconName: 'group-layers',
      iconLabel: 'Studies',
      label: 'Studies',
      component: PanelStudyBrowserTracking.bind(null, {
        commandsManager,
        extensionManager,
        servicesManager,
      }),
    },
    {
      name: 'measurements',
      iconName: 'list-bullets',
      iconLabel: 'Measure',
      label: 'Measurements',
      component: PanelMeasurementTableTracking.bind(null, {
        commandsManager,
        extensionManager,
        servicesManager,
      }),
    },
    {
      name: 'form',
      iconName: 'list-bullets',
      iconLabel: 'Form',
      label: 'Form',
      component: PanelForm.bind(null, {
        commandsManager,
        extensionManager,
        servicesManager,
      }),
    },
    {
      name: 'form-and-measurements',
      iconName: 'list-bullets',
      iconLabel: 'Form',
      label: 'Form',
      component: PanelFormAndMeasurementTable.bind(null, {
        commandsManager,
        extensionManager,
        servicesManager,
      }),
    },
  ];
}

export default getPanelModule;
