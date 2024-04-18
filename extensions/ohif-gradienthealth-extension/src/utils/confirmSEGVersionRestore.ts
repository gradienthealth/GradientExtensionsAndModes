import { ButtonEnums } from '@ohif/ui';

const RESPONSE = {
  CANCEL: 0,
  CONFIRM: 1,
};

export default function (viewportId, servicesManager) {
  const { uiViewportDialogService } = servicesManager.services;
  uiViewportDialogService.hide();
  
  return new Promise(function (resolve, reject) {
    const message = 'Do you want to rollback to this Version?';
    const actions = [
      {
        type: ButtonEnums.type.secondary,
        text: 'No',
        value: RESPONSE.CANCEL,
      },
      {
        type: ButtonEnums.type.primary,
        text: 'Yes',
        value: RESPONSE.CONFIRM,
      },
    ];
    const onSubmit = (result) => {
      uiViewportDialogService.hide();
      resolve(result);
    };

    uiViewportDialogService.show({
      viewportId,
      type: 'info',
      message,
      actions,
      onSubmit,
    });
  });
}
