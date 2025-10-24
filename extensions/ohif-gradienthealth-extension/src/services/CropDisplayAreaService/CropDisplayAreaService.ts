import { pubSubServiceInterface } from '@ohif/core';
import {
  EVENTS as CS_EVENTS,
  eventTarget as CornerstoneEventTarget,
  getEnabledElement,
  cache,
} from '@cornerstonejs/core';

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
      const { HangingProtocolService } = this.serviceManager.services
      const { element, viewportId } = evt.detail
      const enabledElement = getEnabledElement(element);
      const viewport = enabledElement?.viewport
      if(!viewport) return

      const { voiRange, invert } = (viewport as IStackViewport).getProperties()
      let cutoff;
      if (voiRange?.lower && !invert) {
        cutoff = voiRange?.lower
      }
      if(voiRange?.upper && invert){
        cutoff = voiRange?.upper
      }
      if (!cutoff){
        return
      }

      const viewportIdx = parseInt(viewportId.split('-')[1])
      const matchedDisplaySets = Array.from(HangingProtocolService.displaySetMatchDetails.keys())
      const matchedDisplaySet = matchedDisplaySets[viewportIdx]
      if(!matchedDisplaySet) return

      const imageData = viewport.getImageData()
      const scalarData = imageData?.scalarData;
      const dimensions = imageData?.dimensions;
      if(!scalarData || !dimensions) return

      // probably will need to account for
      // imageData.direction
      // interesting that dim[1], dim[0] are reversed for vtk.js => tf.js
      // assume this direction does not change
      const { bboxWidth, bboxHeight, width, height } = tf.tidy(()=>{
        const tensor = tf.tensor2d(new Float32Array(scalarData), [dimensions[1], dimensions[0]]);
        const mask = tensor.greater(cutoff) // get boolean
        const widthBool = mask.any(0) // height?
        const heightBool = mask.any(1) // width?
  
        // get bbox
        const left = widthBool.argMax()
        const right = widthBool.reverse().argMax().mul(-1).add(widthBool.size)
        const top = heightBool.argMax()
        const bottom = heightBool.reverse().argMax().mul(-1).add(heightBool.size)
  
        // get percentage difference in width and height
        const bboxWidth = right.sub(left).dataSync()[0]
        const bboxHeight = bottom.sub(top).dataSync()[0]
        const width = widthBool.size
        const height = heightBool.size

        return {
          bboxWidth,
          bboxHeight,
          width,
          height
        }
      });

      const bboxAspectRatio = bboxWidth/bboxHeight
      const canvasAspectRatio = viewport.sWidth / viewport.sHeight;
      // console.log({bboxAspectRatio, canvasAspectRatio})
      // if(bboxAspectRatio > canvasAspectRatio){
      //   bboxWidth = canvasAspectRatio*bboxHeight
      //   bboxAspectRatio = bboxWidth/bboxHeight
      //   console.log('changed', {bboxAspectRatio, canvasAspectRatio})
      // }

      const bboxWidthPercentage = (bboxWidth/width) // add buffer
      const bboxHeightPercentage = (bboxHeight/height)
      
      // TODO do not hard code, pick the max between bboxwidth and aspect ratio height
      const areaZoom = bboxWidthPercentage
      const panAmount = (1-areaZoom)/2

      if(matchedDisplaySet === 'LMLO'){
        viewport.setDisplayArea({
          imageArea: {
            areaX: areaZoom,
            areaY: areaZoom,
          },
          imageFocalPoint: {
            focalX: 0.5 + (panAmount/2),
            focalY: 0.5,
          },
        }, true)
      }
      if(matchedDisplaySet === 'RMLO'){
        viewport.setDisplayArea({
          imageArea: {
            areaX: areaZoom,
            areaY: areaZoom,
          },
          imageFocalPoint: {
            focalX: 0.5 - (panAmount/2),
            focalY: 0.5,
          },
        }, true)
      }
      if(matchedDisplaySet === 'LCC'){
        viewport.setDisplayArea({
          imageArea: {
            areaX: areaZoom,
            areaY: areaZoom,
          },
          imageFocalPoint: {
            focalX: 0.5 + (panAmount/2),
            focalY: 0.5,
          },
        }, true)
      }
      if(matchedDisplaySet === 'RCC'){
        viewport.setDisplayArea({
          imageArea: {
            areaX: areaZoom,
            areaY: areaZoom,
          },
          imageFocalPoint: {
            focalX: 0.5 - (panAmount/2),
            focalY: 0.5,
          },
        }, true)
      }
    }

    destroy() {
    }

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

    const { imageIds, referencedImageIds } =
      segmentation?.representationData.Labelmap || {};
    const referencedDisplaySetInstanceUID =
      segDisplayset.referencedDisplaySetInstanceUID;
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

      if (
        viewport.displaySetInstanceUIDs.includes(
          referencedDisplaySetInstanceUID
        ) &&
        cornerstoneViewport?.getCurrentImageId()
      ) {
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

    const currentImageId = viewportsWithSegmentation[0].getCurrentImageId();
    const currentImageIdIndex = viewportsWithSegmentation[0].getSliceIndex();
    const imageIdIndex = referencedImageIds.findIndex(
      (referencedImageId) => referencedImageId === currentImageId
    );

    segmentIndex =
      segmentIndex || segmentation.segments.findIndex(({ active }) => active);

    const image = cache.getImage(imageIds[imageIdIndex]);
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

      setDisplayArea(
        viewport,
        zoomFactorsCopy,
        imagePoint,
        currentImageIdIndex
      );
    });
  }
}
