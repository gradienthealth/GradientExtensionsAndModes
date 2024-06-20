import { pubSubServiceInterface } from '@ohif/core';
import {
  EVENTS as CS_EVENTS,
  eventTarget as CornerstoneEventTarget,
  getEnabledElement,
  cache,
  Enums as CSCORE_ENUMS
} from '@cornerstonejs/core';
import { Enums as CSTOOLS_ENUMS } from '@cornerstonejs/tools';

import * as tf from '@tensorflow/tfjs';
import {
  IStackViewport,
  IVolumeViewport,
} from '@cornerstonejs/core/dist/esm/types';
import { getSegDisplaysetsOfReferencedImagesIds } from '../utils';

const EVENTS = {
  CROP_DISPLAY_AREA_INIT: 'event::gradienthealth::CropDisplayAreaService:init',
};

export default class CropDisplayAreaService {
  private serviceManager;
  private listeners;
  public EVENTS;

  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.listeners = {};
    this.EVENTS = EVENTS;
    window.tf = tf;
    Object.assign(this, pubSubServiceInterface);
  }

  init(){
    CornerstoneEventTarget.addEventListener(CS_EVENTS.STACK_VIEWPORT_NEW_STACK, (evt)=>{
        const { HangingProtocolService } = this.serviceManager.services
        if(HangingProtocolService.protocol.id === 'breast') this.handleBreastDensityHP(evt)
      })
  }

  private handleBreastDensityHP(evt){
    const { HangingProtocolService, cornerstoneViewportService } =
      this.serviceManager.services;
    const { element, viewportId } = evt.detail;
    const enabledElement = getEnabledElement(element);
    const viewport = enabledElement?.viewport;
    if (!viewport) return;

    const viewportInfo =
        cornerstoneViewportService.getViewportInfo(viewportId);
    const matchedDisplaySets = Array.from(
      HangingProtocolService.displaySetMatchDetails.values()
    );
    const matchedDisplaySetIndex = matchedDisplaySets.findIndex(
      (displayset) =>
        displayset.displaySetInstanceUID ===
        viewportInfo.viewportData.data.displaySetInstanceUID
    );

    const matchedDisplaySetKeys = Array.from(
      HangingProtocolService.displaySetMatchDetails.keys()
    );
    const matchedDisplaySet = matchedDisplaySetKeys[matchedDisplaySetIndex];
    if (!matchedDisplaySet) return;

    const imageData = viewport.getImageData();
    const scalarData = imageData?.scalarData;
    const dimensions = imageData?.dimensions;
    if (!scalarData || !dimensions) return;

    // probably will need to account for
    // imageData.direction
    // interesting that dim[1], dim[0] are reversed for vtk.js => tf.js
    // assume this direction does not change
    const { bboxWidth, bboxHeight, width, height } = tf.tidy(() => {
      const tensor = tf.tensor2d(new Float32Array(scalarData), [
        dimensions[1],
        dimensions[0],
      ]);
      const cutoff = tensor.max().dataSync()[0] * 0.2; // 20% of max pixel value
      const mask = tensor.greater(cutoff); // get boolean
      const widthBool = mask.any(0); // height?
      const heightBool = mask.any(1); // width?

      // get bbox
      const left = widthBool.argMax();
      const right = widthBool.reverse().argMax().mul(-1).add(widthBool.size);
      const top = heightBool.argMax();
      const bottom = heightBool
          .reverse()
          .argMax()
          .mul(-1)
          .add(heightBool.size);

      // get percentage difference in width and height
      const bboxWidth = right.sub(left).dataSync()[0];
      const bboxHeight = bottom.sub(top).dataSync()[0];
      const width = widthBool.size;
      const height = heightBool.size;

      return {
        bboxWidth,
        bboxHeight,
        width,
        height,
      };
    });

    const bboxAspectRatio = bboxWidth / bboxHeight;
    const canvasAspectRatio = viewport.sWidth / viewport.sHeight;
    // console.log({bboxAspectRatio, canvasAspectRatio})
    // if(bboxAspectRatio > canvasAspectRatio){
    //   bboxWidth = canvasAspectRatio*bboxHeight
    //   bboxAspectRatio = bboxWidth/bboxHeight
    //   console.log('changed', {bboxAspectRatio, canvasAspectRatio})
    // }

    const bboxWidthPercentage = bboxWidth / width; // add buffer
    const bboxHeightPercentage = bboxHeight / height;

    // TODO do not hard code, pick the max between bboxwidth and aspect ratio height
    const areaZoom = bboxWidthPercentage;
    //const panAmount = (1 - areaZoom) / 2;

    if (matchedDisplaySet === 'LMLO') {
      viewport.setDisplayArea(
        {
          imageArea: [areaZoom, areaZoom],
          imageCanvasPoint: {
            canvasPoint: [0, 0.5],
            imagePoint: [0, 0.5],
          },
          storeAsInitialCamera: true,
        },
        true
      );
    }
    if (matchedDisplaySet === 'RMLO') {
      viewport.setDisplayArea(
        {
          imageArea: [areaZoom, areaZoom],
          imageCanvasPoint: {
            canvasPoint: [1, 0.5],
            imagePoint: [1, 0.5],
          },
          storeAsInitialCamera: true,
        },

        true
      );
    }
    if (matchedDisplaySet === 'LCC') {
      viewport.setDisplayArea(
        {
          imageArea: [areaZoom, areaZoom],
          imageCanvasPoint: {
            canvasPoint: [0, 0.5],
            imagePoint: [0, 0.5],
          },
          storeAsInitialCamera: true,
        },
        true
      );
    }
    if (matchedDisplaySet === 'RCC') {
      viewport.setDisplayArea(
        {
          imageArea: [areaZoom, areaZoom],
          imageCanvasPoint: {
            canvasPoint: [1, 0.5],
            imagePoint: [1, 0.5],
          },
          storeAsInitialCamera: true,
        },
        true
      );
    }
  }

  destroy() {
    }

  public async focusToSegment(segmentationId, segmentIndex) {
    const { segmentationService, displaySetService } =
      this.serviceManager.services;

    const segmentation = segmentationService.getSegmentation(segmentationId);
    const segDisplayset = displaySetService.getDisplaySetByUID(
      segmentation.displaySetInstanceUID
    );
    if (segDisplayset.Modality !== 'SEG') {
      return;
    }

    const imageIdReferenceMap =
      segmentation?.representationData[segmentation.type].imageIdReferenceMap;

    segmentIndex = segmentIndex || segmentation.activeSegmentIndex;

    if (imageIdReferenceMap) {
      await this.focusToSegmentInStack(
        segmentIndex,
        segDisplayset,
        imageIdReferenceMap
      );
    } else {
      await this.focusToSegmentVolume(
        segmentIndex,
        segDisplayset,
        segmentationId
      );
    }

    segmentationService.highlightSegment(segmentationId, segmentIndex);
  }

  focusToSegmentInStack = async (
    segmentIndex,
    segDisplaySet,
    imageIdReferenceMap
  ) => {
    const {
      viewportGridService,
      cornerstoneViewportService,
      displaySetService,
    } = this.serviceManager.services;

    const firstImage = cache.getImage(
      imageIdReferenceMap.values().next().value
    );
    const { rows, columns } = firstImage;
    const dimensions = [columns, rows, imageIdReferenceMap.size];

    const framesWithSegment: any[] = [];

    for (const [index, segImageId] of imageIdReferenceMap.values()) {
      const image = cache.getImage(segImageId);
      const pixelData = image.getPixelData();

      const mask = tf.tidy(() => {
        const tensor = tf.tensor2d(new Float32Array(pixelData), [
          dimensions[1],
          dimensions[0],
        ]);

        return tensor.equal(segmentIndex); // get boolean
      });

      const hasSegment = mask.dataSync().some(Boolean);

      if (hasSegment) {
        framesWithSegment.push({ mask, index });
      }

      tf.dispose(hasSegment);
    }

    const segmentBounds = {
      left: dimensions[0] - 1,
      top: dimensions[1] - 1,
      right: 0,
      bottom: 0,
    };
    let densestFrame = { index: 0, area: 0 };

    for (let i = 0; i < framesWithSegment.length; i++) {
      const mask = framesWithSegment[i].mask;

      const maskCoordinates = await tf.whereAsync(mask);

      const { xMax, yMax, xMin, yMin } = tf.tidy(() => {
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
      });

      const area = (xMax + 1 - xMin) * (yMax + 1 - yMin);
      if (area > densestFrame.area) {
        densestFrame = {
          area,
          index: framesWithSegment[i].index,
        };
      }

      segmentBounds.left = Math.min(segmentBounds.left, xMin);
      segmentBounds.right = Math.max(segmentBounds.right, xMax);
      segmentBounds.top = Math.min(segmentBounds.top, yMin);
      segmentBounds.bottom = Math.max(segmentBounds.bottom, yMax);
    }

    const { activeViewportId } = viewportGridService.getState();
    const viewportsWithSegmentation = getViewportsWithSegmentation(
      segDisplaySet,
      this.serviceManager
    );

    let bboxWidth = Math.abs(segmentBounds.right + 1 - segmentBounds.left);
    let bboxHeight = Math.abs(segmentBounds.bottom + 1 - segmentBounds.top);
    let width = dimensions[0];
    let height = dimensions[1];
    const imageAspectRatio = width / height;

    const imagePoint = [
      (segmentBounds.right + segmentBounds.left) / (2 * width),
      (segmentBounds.bottom + segmentBounds.top) / (2 * height),
    ] as [number, number];
    const zoomFactors = {
      x: bboxWidth / width,
      y: bboxHeight / height,
    };

    viewportsWithSegmentation.forEach((viewport) => {
      viewport.scroll(densestFrame.index - viewport.getTargetImageIdIndex());

      const canvasAspectRatio = viewport.sWidth / viewport.sHeight;
      const zoomFactorsCopy = { ...zoomFactors };
      correctZoomFactors(zoomFactorsCopy, imageAspectRatio, canvasAspectRatio);

      setDisplayArea(viewport, zoomFactorsCopy, imagePoint);
    });

    if (!viewportsWithSegmentation.length) {
      const activeViewport =
        cornerstoneViewportService.getCornerstoneViewport(activeViewportId);

      handleFocusingForNewImage(
        activeViewport,
        displaySetService,
        zoomFactors,
        imagePoint,
        imageAspectRatio
      );
    }
  };

  focusToSegmentVolume = async (
    segmentIndex,
    segDisplaySet,
    segmentationId
  ) => {
    const {
      viewportGridService,
      cornerstoneViewportService,
      displaySetService,
    } = this.serviceManager.services;

    const volume = cache.getVolume(segmentationId);
    const { dimensions } = volume;
    const pixelData = volume.scalarData;

    const mask = tf.tidy(() => {
      const tensor = tf.tensor3d(new Float32Array(pixelData), [
        dimensions[2],
        dimensions[0],
        dimensions[1],
      ]);

      return tensor.equal(segmentIndex); // get boolean
    });

    const maskCoordinates = await tf.whereAsync(mask);

    const { xMax, yMax, xMin, yMin } = tf.tidy(() => {
      const transpose = tf.einsum('ij->ji', maskCoordinates);
      tf.dispose(mask);
      tf.dispose(maskCoordinates);

      let xMin = 0,
        xMax = dimensions[0],
        yMin = 0,
        yMax = dimensions[1];

      if (transpose.size !== 0) {
        xMin = transpose.gather(2).min().dataSync()[0];
        xMax = transpose.gather(2).max().dataSync()[0];
        yMin = transpose.gather(1).min().dataSync()[0];
        yMax = transpose.gather(1).max().dataSync()[0];
      }

      return { xMax, yMax, xMin, yMin };
    });

    const { activeViewportId } = viewportGridService.getState();
    const viewportsWithSegmentation = getViewportsWithSegmentation(
      segDisplaySet,
      this.serviceManager
    );

    let bboxWidth = xMax + 1 - xMin;
    let bboxHeight = yMax + 1 - yMin;
    let width = dimensions[0];
    let height = dimensions[1];
    const imageAspectRatio = width / height;

    const imagePoint = [
      (xMax + xMin) / (2 * width),
      (yMax + yMin) / (2 * height),
    ] as [number, number];
    const zoomFactors = {
      x: bboxWidth / width,
      y: bboxHeight / height,
    };

    viewportsWithSegmentation.forEach((viewport) => {
      const canvasAspectRatio = viewport.sWidth / viewport.sHeight;
      const zoomFactorsCopy = { ...zoomFactors };
      correctZoomFactors(zoomFactorsCopy, imageAspectRatio, canvasAspectRatio);

      setDisplayArea(viewport, zoomFactorsCopy, imagePoint);
    });

    if (!viewportsWithSegmentation.length) {
      const activeViewport =
        cornerstoneViewportService.getCornerstoneViewport(activeViewportId);

      handleFocusingForNewImage(
        activeViewport,
        displaySetService,
        zoomFactors,
        imagePoint,
        imageAspectRatio
      );
    }
  };
}

const setDisplayArea = (
  viewport: IStackViewport | IVolumeViewport,
  zoomFactors: { x: number; y: number },
  imagePoint: [number, number]
) => {
  viewport.setDisplayArea({
    imageArea: <[number, number]>[zoomFactors.x, zoomFactors.y],
    imageCanvasPoint: { imagePoint, canvasPoint: <[number, number]>[0.5, 0.5] },
  });
  viewport.render();
};

const handleFocusingForNewImage = (
  viewport: IStackViewport | IVolumeViewport,
  displaySetService: any,
  zoomFactors: { x: number; y: number },
  imagePoint: [number, number],
  imageAspectRatio: number
) => {
  const canvasAspectRatio = viewport.sWidth / viewport.sHeight;

  const eventElement =
    viewport.type === CSCORE_ENUMS.ViewportType.STACK
      ? CornerstoneEventTarget
      : viewport.element;
  const eventName =
    viewport.type === CSCORE_ENUMS.ViewportType.STACK
      ? CS_EVENTS.STACK_VIEWPORT_NEW_STACK
      : CS_EVENTS.VOLUME_VIEWPORT_NEW_VOLUME;

  const newImageListener = (evt) => {
    const segDisplaySetsOfLoadedSeries = getSegDisplaysetsOfReferencedImagesIds(
      evt.detail.imageIds,
      displaySetService
    );

    let segmentationsRenderedCount = 0;
    const segmentationRenderedListener = () => {
      if (
        ++segmentationsRenderedCount === segDisplaySetsOfLoadedSeries.length
      ) {
        correctZoomFactors(zoomFactors, imageAspectRatio, canvasAspectRatio);
        setDisplayArea(viewport, zoomFactors, imagePoint);

        CornerstoneEventTarget.removeEventListener(
          CSTOOLS_ENUMS.Events.SEGMENTATION_RENDERED,
          segmentationRenderedListener
        );
      }
    };

    CornerstoneEventTarget.addEventListener(
      CSTOOLS_ENUMS.Events.SEGMENTATION_RENDERED,
      segmentationRenderedListener
    );

    eventElement.removeEventListener(eventName, newImageListener);
  };

  eventElement.addEventListener(eventName, newImageListener);
};

const correctZoomFactors = (
  zoomFactors: { x: number; y: number },
  imageAspectRatio: number,
  canvasAspectRatio: number
) => {
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
};

const getViewportsWithSegmentation = (segDisplaySet, servicesManager) => {
  const { viewportGridService, cornerstoneViewportService } =
    servicesManager.services;
  const referencedDisplaySetInstanceUID =
    segDisplaySet.referencedDisplaySetInstanceUID;
  const { viewports } = viewportGridService.getState();
  const viewportsWithSegmentation: IStackViewport[] | IVolumeViewport[] = [];

  viewports.forEach((viewport) => {
    if (
      viewport.displaySetInstanceUIDs.includes(referencedDisplaySetInstanceUID)
    ) {
      viewportsWithSegmentation.push(
        cornerstoneViewportService.getCornerstoneViewport(viewport.viewportId)
      );
    }
  });

  return viewportsWithSegmentation;
};
