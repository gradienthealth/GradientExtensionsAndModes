import {
  IStackViewport,
  IVolumeViewport,
} from '@cornerstonejs/core/dist/esm/types';

export function setDisplayArea(
  viewport: IStackViewport | IVolumeViewport,
  zoomFactors: { x: number; y: number },
  imagePoint: [number, number],
  imageIdIndex: number
) {
  viewport.setDisplayArea({
    imageArea: <[number, number]>[zoomFactors.x, zoomFactors.y],
    imageCanvasPoint: { imagePoint, canvasPoint: <[number, number]>[0.5, 0.5] },
  });
  viewport.scroll(imageIdIndex - viewport.getSliceIndex());
  viewport.render();
}

export function correctZoomFactors(
  zoomFactors: { x: number; y: number },
  imageAspectRatio: number,
  canvasAspectRatio: number
) {
  if (imageAspectRatio < canvasAspectRatio) {
    zoomFactors.x /= canvasAspectRatio / imageAspectRatio;
  }
  if (imageAspectRatio > canvasAspectRatio) {
    zoomFactors.y /= imageAspectRatio / canvasAspectRatio;
  }

  if (zoomFactors.x > 0.8 || zoomFactors.y > 0.8) {
    return;
  }

  const zoomOutPercentatage = 80;

  zoomFactors.x /= zoomOutPercentatage / 100;
  zoomFactors.y /= zoomOutPercentatage / 100;
}
