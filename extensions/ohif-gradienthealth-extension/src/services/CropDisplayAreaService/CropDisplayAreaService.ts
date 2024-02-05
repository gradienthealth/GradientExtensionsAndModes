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

      const { voiRange, invert } = (viewport as IStackViewport).getProperties();
      let cutoff;
      if (voiRange?.lower && !invert) {
        cutoff = voiRange?.lower;
      }
      if (voiRange?.upper && invert) {
        cutoff = voiRange?.upper;
      }
      if (!cutoff) {
        return;
      }

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
    const {
      segmentationService,
      viewportGridService,
      cornerstoneViewportService,
      displaySetService,
    } = this.serviceManager.services;

    const segmentation = segmentationService.getSegmentation(segmentationId);
    const segDisplayset = displaySetService.getDisplaySetByUID(segmentation.displaySetInstanceUID);
    if (segDisplayset.Modality !== 'SEG') {
      return;
    }

    const imageIdReferenceMap =
      segmentation?.representationData[segmentation.type].imageIdReferenceMap;

    segmentIndex = segmentIndex || segmentation.activeSegmentIndex;

    let dimensions, pixelData;

    if (imageIdReferenceMap) {
      const image = cache.getImage(imageIdReferenceMap.values().next().value);
      const { rows, columns } = image;
      dimensions = [columns, rows, imageIdReferenceMap.size];
      pixelData = image.getPixelData();
    } else {
      const volume = cache.getVolume(segmentationId);
      ({ dimensions } = volume);
      pixelData = volume.scalarData;
    }

    const mask = tf.tidy(() => {
      let tensor;
      if (imageIdReferenceMap) {
        tensor = tf.tensor2d(new Float32Array(pixelData), [
          dimensions[1],
          dimensions[0],
        ]);
      } else {
        tensor = tf.tensor3d(new Float32Array(pixelData), [
          dimensions[2],
          dimensions[0],
          dimensions[1],
        ]);
      }

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
        if (imageIdReferenceMap) {
          xMin = transpose.gather(1).min().dataSync()[0];
          xMax = transpose.gather(1).max().dataSync()[0];
          yMin = transpose.gather(0).min().dataSync()[0];
          yMax = transpose.gather(0).max().dataSync()[0];
        } else {
          xMin = transpose.gather(2).min().dataSync()[0];
          xMax = transpose.gather(2).max().dataSync()[0];
          yMin = transpose.gather(1).min().dataSync()[0];
          yMax = transpose.gather(1).max().dataSync()[0];
        }
      }

      return { xMax, yMax, xMin, yMin };
    });

    const referencedDisplaySetInstanceUID = segDisplayset.referencedDisplaySetInstanceUID;
    const { viewports, activeViewportId } = viewportGridService.getState();
    const viewportsWithSegmentation: IStackViewport | IVolumeViewport = [];
    viewports.forEach((viewport) => {
      if (viewport.displaySetInstanceUIDs.includes(referencedDisplaySetInstanceUID)) {
        viewportsWithSegmentation.push(
          cornerstoneViewportService.getCornerstoneViewport(viewport.viewportId)
        );
      }
    });

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

      handleFocusingForNewStack(
        activeViewport,
        displaySetService,
        zoomFactors,
        imagePoint,
        imageAspectRatio
      );
    }
  }
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

const handleFocusingForNewStack = (
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