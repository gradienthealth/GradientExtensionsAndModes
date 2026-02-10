import {
  PanelForm,
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
      name: 'form',
      iconName: 'tab-list-view',
      iconLabel: 'Form',
      label: 'Form',
      component: PanelForm.bind(null, {
        commandsManager,
        extensionManager,
        servicesManager,
      }),
    },
  ];
}

export default getPanelModule;
