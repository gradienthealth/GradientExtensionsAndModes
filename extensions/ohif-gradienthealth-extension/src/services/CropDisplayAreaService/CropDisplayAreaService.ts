import { pubSubServiceInterface } from '@ohif/core';
import {
  EVENTS as CS_EVENTS,
  eventTarget as CornerstoneEventTarget,
  getEnabledElement,
  cache,
  Enums,
  utilities,
  Types,
} from '@cornerstonejs/core';
import { segmentation as cstSegmentation } from '@cornerstonejs/tools';
import { vec3 } from 'gl-matrix';

import * as tf from '@tensorflow/tfjs';
import {
  IStackViewport,
  IVolumeViewport,
} from '@cornerstonejs/core/dist/esm/types';
import { correctZoomFactors, setDisplayArea } from './utils';

const EVENTS = {
  CROP_DISPLAY_AREA_INIT: 'event::gradienthealth::CropDisplayAreaService:init',
};

export default class CropDisplayAreaService {
  private serviceManager;
  public EVENTS;

  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.EVENTS = EVENTS;
    // @ts-expect-error Property 'tf' does not exist on type 'Window' since it is a new property to store tenserflow library.
    window.tf = tf;
    Object.assign(this, pubSubServiceInterface);
  }

  destroy() {}

  public async focusToSegment(
    segmentationId: string,
    segmentIndex: number
  ): Promise<void> {
    const {
      segmentationService,
      viewportGridService,
      cornerstoneViewportService,
      displaySetService,
      uiNotificationService,
    } = this.serviceManager.services;

    const segmentation = segmentationService.getSegmentation(segmentationId);
    const segDisplayset = displaySetService.getDisplaySetByUID(segmentationId);
    if (segDisplayset.Modality !== 'SEG') {
      return;
    }

    const { imageIds, referencedImageIds, volumeId } =
      segmentation?.representationData.Labelmap || {};
    const { viewports } = viewportGridService.getState();

    if (!imageIds || !referencedImageIds) {
      uiNotificationService.show({
        title: 'Segment focusing',
        type: 'warning',
        message: 'No labelmap representationdata found',
      });
      return;
    }

    const viewportsWithSegmentation: IStackViewport | IVolumeViewport = [];
    viewports.forEach((viewport) => {
      const cornerstoneViewport =
        cornerstoneViewportService.getCornerstoneViewport(viewport.viewportId);
      const segmentationRepresentations =
        cstSegmentation.state.getSegmentationRepresentations(
          viewport.viewportId,
          { segmentationId }
        );
      if (segmentationRepresentations?.length > 0) {
        viewportsWithSegmentation.push(cornerstoneViewport);
      }
    });

    if (!viewportsWithSegmentation.length) {
      uiNotificationService.show({
        title: 'Segment focusing',
        type: 'warning',
        message: 'No viewports found with original orientation',
      });
      return;
    }

    segmentIndex =
      segmentIndex || segmentation.segments.findIndex(({ active }) => active);
    const segmentCachedStats = segmentation.segments[segmentIndex].cachedStats;
    const segmentCenterWorld =
      segmentCachedStats.namedStats?.center.value ||
      segmentCachedStats.center.world;

    viewportsWithSegmentation.forEach(async (viewport) => {
      let xMin, xMax, yMin, yMax;
      let currentImageId: string, currentImageIdIndex: number;

      if (viewport.type === Enums.ViewportType.STACK) {
        currentImageId = viewport.getCurrentImageId();
        currentImageIdIndex = (referencedImageIds as string[]).findIndex(
          (referencedImageId) => referencedImageId === currentImageId
        );
      } else {
        const volume = cache.getVolume(volumeId);

        currentImageId = utilities.getClosestImageId(
          volume,
          segmentCenterWorld,
          volume.direction.slice(6, 9)
        );
        currentImageIdIndex = (imageIds as string[]).findIndex(
          (referencedImageId) => referencedImageId === currentImageId
        );
      }
      const image = cache.getImage(imageIds[currentImageIdIndex]);
      const { rows, columns } = image;
      const dimensions = [columns, rows, imageIds.length];
      const pixelData = image.getPixelData();

      const mask = tf.tidy(() => {
        let tensor;
        tensor = tf.tensor2d(new Float32Array(pixelData), [
          dimensions[1],
          dimensions[0],
        ]);

        return tensor.equal(segmentIndex); // get boolean
      });

      const maskCoordinates = await tf.whereAsync(mask);

      ({ xMax, yMax, xMin, yMin } = tf.tidy(() => {
        const transpose = tf.einsum('ij->ji', maskCoordinates);
        tf.dispose(mask);
        tf.dispose(maskCoordinates);

        let xMin = 0,
          xMax = dimensions[0],
          yMin = 0,
          yMax = dimensions[1];

        if (transpose.size !== 0) {
          xMin = transpose.gather(1).min().dataSync()[0];
          xMax = transpose.gather(1).max().dataSync()[0];
          yMin = transpose.gather(0).min().dataSync()[0];
          yMax = transpose.gather(0).max().dataSync()[0];
        }

        return { xMax, yMax, xMin, yMin };
      }));

      const bboxWidth = xMax + 1 - xMin;
      const bboxHeight = yMax + 1 - yMin;
      const width = dimensions[0];
      const height = dimensions[1];

      const imagePoint = [
        (xMax + xMin) / (2 * width),
        (yMax + yMin) / (2 * height),
      ] as [number, number];
      const zoomFactors = {
        x: bboxWidth / width,
        y: bboxHeight / height,
      };
      const canvasAspectRatio = viewport.sWidth / viewport.sHeight;
      const bboxAspectRatio = bboxWidth / bboxHeight;
      const zoomFactorsCopy = { ...zoomFactors };
      correctZoomFactors(zoomFactorsCopy, bboxAspectRatio, canvasAspectRatio);

      if (viewport.type === Enums.ViewportType.STACK) {
        setDisplayArea(
          viewport,
          zoomFactorsCopy,
          imagePoint,
          currentImageIdIndex
        );
      } else {
        const camera = viewport.getCamera();
        const currentPos = camera.position;
        const currentFocal = camera.focalPoint;
        const viewPlaneNormal = camera.viewPlaneNormal;
        const distance = vec3.distance(currentPos, currentFocal);

        const newPosition = [0, 0, 0];
        const offsetVector = [
          viewPlaneNormal[0] * distance,
          viewPlaneNormal[1] * distance,
          viewPlaneNormal[2] * distance,
        ];
        vec3.add(newPosition, segmentCenterWorld, offsetVector);

        let parallelScale;

        if (bboxAspectRatio > canvasAspectRatio) {
          const requiredHeight = bboxWidth / canvasAspectRatio;
          parallelScale = requiredHeight / 3;
        } else {
          parallelScale = bboxHeight / 3;
        }

        if (zoomFactors.x === 1 && zoomFactors.y === 1) {
          return;
        }

        viewport.setCamera({
          focalPoint: segmentCenterWorld,
          position: newPosition,
          parallelScale: parallelScale,
        });
        viewport.render();
      }
    });
  }
}
