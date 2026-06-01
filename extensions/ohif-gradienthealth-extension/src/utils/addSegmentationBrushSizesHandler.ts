import { eventTarget, Enums } from '@cornerstonejs/core';
import { MODIFYING_BUTTONS } from './constants';
import { ToolButton } from './types';

export default function addSegmentationBrushSizesHandler(servicesManager) {
  eventTarget.addEventListenerOnce(Enums.Events.ELEMENT_ENABLED, (evt) => {
    evt.detail.element.removeEventListener(
      Enums.Events.VIEWPORT_NEW_IMAGE_SET,
      () => overrideSegmentationSizes(servicesManager)
    );
    evt.detail.element.addEventListener(
      Enums.Events.VIEWPORT_NEW_IMAGE_SET,
      () => overrideSegmentationSizes(servicesManager)
    );
  });
}

export function overrideSegmentationSizes(servicesManager) {
  const { toolbarService } = servicesManager.services;

  const buttons: ToolButton[] = Object.keys(MODIFYING_BUTTONS).map((buttonId) =>
    toolbarService.getButton(buttonId)
  );

  const params = new URLSearchParams(window.location.search);
  const defaultBrushSizeInMm = +(params.get('defaultBrushSize') || 2);
  let minBrushSizeInMm = +(params.get('minBrushSize') || 2);
  let maxBrushSizeInMm = +(params.get('maxBrushSize') || 3);

  const highestPixelSpacing = getPixelToMmConversionFactor(servicesManager);

  if (!highestPixelSpacing) {
    return;
  }

  const lowestBrushRadius = highestPixelSpacing / 2;

  if (minBrushSizeInMm < lowestBrushRadius) {
    minBrushSizeInMm = lowestBrushRadius;
  }
  if (maxBrushSizeInMm < lowestBrushRadius) {
    maxBrushSizeInMm = highestPixelSpacing;
  }

  const min = +minBrushSizeInMm.toFixed(2);
  const max = +maxBrushSizeInMm.toFixed(2);
  const defaultValue = defaultBrushSizeInMm;
  const step = +((maxBrushSizeInMm - minBrushSizeInMm) / 100).toFixed(2);

  buttons.forEach((button) => {
    const radiusOption = button.props.options.find(
      ({ id }) => id === MODIFYING_BUTTONS[button.id]
    );

    if (!radiusOption) {
      return;
    }

    radiusOption.min = min;
    radiusOption.max = max;
    radiusOption.value = defaultValue;
    radiusOption.step = step;
  });

  toolbarService.addButtons(buttons, true);
}

function getPixelToMmConversionFactor(servicesManager) {
  const { viewportGridService, cornerstoneViewportService } =
    servicesManager.services;
  const { activeViewportId } = viewportGridService.getState();
  const viewport =
    cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
  const imageData = viewport?.getImageData();

  if (!imageData) {
    return;
  }

  const { spacing } = imageData;
  return Math.max(spacing[0], spacing[1]);
}
