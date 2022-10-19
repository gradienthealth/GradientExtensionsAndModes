import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import OHIF, { utils } from '@ohif/core';

import {
  Notification,
  ViewportActionBar,
  useCine,
  useViewportGrid,
  useViewportDialog,
} from '@ohif/ui';

import { annotation } from '@cornerstonejs/tools';

const { formatDate } = utils;

function GradientCornerstoneViewport(props) {
  const {
    children,
    displaySets,
    viewportIndex,
    viewportLabel,
    servicesManager,
    extensionManager,
    commandsManager,
  } = props;

  const {
    CornerstoneViewportService,
  } = servicesManager.services;

  // Todo: handling more than one displaySet on the same viewport
  const displaySet = displaySets[0];

  const [{ activeViewportIndex }] = useViewportGrid();
  const [{ isCineEnabled, cines }, cineService] = useCine();
  const [viewportDialogState] = useViewportDialog();
  const [element, setElement] = useState(null);

  const viewportId = CornerstoneViewportService.getViewportId(viewportIndex);

  const {
    Modality,
    SeriesDate,
    SeriesDescription,
    SeriesInstanceUID,
    SeriesNumber,
  } = displaySet;

  const {
    PatientID,
    PatientName,
    PatientSex,
    PatientAge,
    SliceThickness,
    SpacingBetweenSlices,
    ManufacturerModelName,
  } = displaySet.images[0];

  useEffect(() => {
    annotation.config.style.setViewportToolStyles(`viewport-${viewportIndex}`, {
      global: {
        lineDash: '',
      },
    });

    CornerstoneViewportService.getRenderingEngine().renderViewport(viewportId);

    return () => {
      annotation.config.style.setViewportToolStyles(viewportId, {});
    };
  }, []);

  useEffect(() => {
    if (!cines || !cines[viewportIndex]) {
      return;
    }

    const cine = cines[viewportIndex];
    const isPlaying = (cine && cine.isPlaying) || false;
    const frameRate = (cine && cine.frameRate) || 24;

    const validFrameRate = Math.max(frameRate, 1);

    if (isPlaying) {
      cineService.playClip(element, {
        framesPerSecond: validFrameRate,
      });
    } else {
      cineService.stopClip(element);
    }
  }, [cines, viewportIndex, cineService, element, displaySet]);


  /**
   * OnElementEnabled callback which is called after the cornerstoneExtension
   * has enabled the element. Note: we delegate all the image rendering to
   * cornerstoneExtension, so we don't need to do anything here regarding
   * the image rendering, element enabling etc.
   */
  const onElementEnabled = evt => {
    setElement(evt.detail.element);
  };

  const getCornerstoneViewport = () => {
    const { component: Component } = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.viewportModule.cornerstone'
    );

    return <Component {...props} onElementEnabled={onElementEnabled} />;
  };

  const cine = cines[viewportIndex];
  const isPlaying = (cine && cine.isPlaying) || false;

  return (
    <>
      <ViewportActionBar
        onDoubleClick={evt => {
          evt.stopPropagation();
          evt.preventDefault();
        }}
        onSeriesChange={()=>{}}
        studyData={{
          label: viewportLabel,
          isRehydratable: false,
          studyDate: formatDate(SeriesDate), // TODO: This is series date. Is that ok?
          currentSeries: String(SeriesNumber), // TODO - switch entire currentSeries to be UID based or actual position based
          seriesDescription: SeriesDescription,
          modality: Modality,
          isTracked: true,
          patientInformation: {
            patientName: PatientName
              ? OHIF.utils.formatPN(PatientName.Alphabetic)
              : '',
            patientSex: PatientSex || '',
            patientAge: PatientAge || '',
            MRN: PatientID || '',
            thickness: SliceThickness
              ? `${parseFloat(SliceThickness).toFixed(2)}mm`
              : '',
            spacing:
              SpacingBetweenSlices !== undefined
                ? `${parseFloat(SpacingBetweenSlices).toFixed(2)}mm`
                : '',
            scanner: ManufacturerModelName || '',
          },
        }}
        showNavArrows={false}
        showStatus={false}
        showCine={isCineEnabled}
        cineProps={{
          isPlaying,
          onClose: () => commandsManager.runCommand('toggleCine'),
          onPlayPauseChange: isPlaying =>
            cineService.setCine({
              id: activeViewportIndex,
              isPlaying,
            }),
          onFrameRateChange: frameRate =>
            cineService.setCine({
              id: activeViewportIndex,
              frameRate,
            }),
        }}
      />
      {/* TODO: Viewport interface to accept stack or layers of content like this? */}
      <div className="relative flex flex-row w-full h-full overflow-hidden">
        {getCornerstoneViewport()}
        <div className="absolute w-full">
          {viewportDialogState.viewportIndex === viewportIndex && (
            <Notification
              id={viewportDialogState.id}
              message={viewportDialogState.message}
              type={viewportDialogState.type}
              actions={viewportDialogState.actions}
              onSubmit={viewportDialogState.onSubmit}
              onOutsideClick={viewportDialogState.onOutsideClick}
            />
          )}
        </div>
      </div>
    </>
  );
}

GradientCornerstoneViewport.propTypes = {
  displaySets: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
  viewportIndex: PropTypes.number.isRequired,
  dataSource: PropTypes.object,
  children: PropTypes.node,
  customProps: PropTypes.object,
};

GradientCornerstoneViewport.defaultProps = {
  customProps: {},
};

export default GradientCornerstoneViewport;
