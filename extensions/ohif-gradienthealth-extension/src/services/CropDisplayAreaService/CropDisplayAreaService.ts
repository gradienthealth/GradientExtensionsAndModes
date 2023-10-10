import { pubSubServiceInterface } from '@ohif/core';
import { 
    EVENTS as CS_EVENTS,
    eventTarget as CornerstoneEventTarget,
    getEnabledElement
} from '@cornerstonejs/core';

import * as tf from '@tensorflow/tfjs';
import { IStackViewport } from '@cornerstonejs/core/dist/esm/types';

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
  }
  