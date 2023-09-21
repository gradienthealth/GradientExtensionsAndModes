import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import OHIF, { utils } from '@ohif/core';
import JSZip from 'jszip';
import _ from 'lodash';

import {
  Notification,
  ViewportActionBar,
  useViewportDialog,
  Icon,
} from '@ohif/ui';

import { useTranslation } from 'react-i18next';
import { display } from '@mui/system';

const { formatDate } = utils;

function GradientCornerstoneViewport(props) {
  const {
    children,
    displaySets,
    viewportId,
    viewportLabel,
    servicesManager,
    extensionManager,
    commandsManager,
    viewportOptions,
  } = props;

  const { t } = useTranslation('GradientCornerstoneViewport');

  const {
    measurementService,
    cornerstoneViewportService,
    userAuthenticationService,
    UINotificationService,
  } = servicesManager.services;

  // Todo: handling more than one displaySet on the same viewport
  const displaySet = displaySets[0];

  const [viewportDialogState] = useViewportDialog();

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

  const getCornerstoneViewport = () => {
    const { component: Component } = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.viewportModule.cornerstone'
    );

    return <Component {...props} />;
  };

  const downloadStudy = () => {
    UINotificationService.show({
      title: 'Download',
      message: `Downloading ${displaySet['SeriesInstanceUID']}...`,
      type: 'warn',
    });

    const urls = _.uniq(
      displaySet.instances.map((ele) => ele.url.split('dicomweb:')[1])
    );
    async function downloadFilesAndCreateZip(fileUrls) {
      try {
        // Download all files in parallel
        const files = await Promise.all(
          fileUrls.map(async (url) => {
            const response = await fetch(url, {
              headers: userAuthenticationService.getAuthorizationHeader(),
            });
            if (response.ok) {
              const blob = await response.blob();
              return {
                filename:
                  displaySet['SeriesInstanceUID'] +
                  url.split(`${displaySet['SeriesInstanceUID']}`).slice(-1),
                blob,
              };
            } else {
              throw new Error(`Error downloading file: ${url}`);
            }
          })
        );

        // Create a zip object
        const zip = new JSZip();
        files.forEach((file) => zip.file(file.filename, file.blob));

        // Generate the zip file and trigger a download in the browser
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${displaySet['SeriesInstanceUID']}.zip`;
        link.click();
        URL.revokeObjectURL(zipUrl);
      } catch (error) {
        console.error('Error downloading files:', error);
      }
    }

    downloadFilesAndCreateZip(urls)
      .then(() => {
        UINotificationService.show({
          title: 'Download',
          message: `Downloaded ${displaySet['SeriesInstanceUID']}`,
          type: 'success',
        });
      })
      .catch((err) => {
        UINotificationService.show({
          title: 'Download',
          message: `Could not downlad ${displaySet['SeriesInstanceUID']}`,
          type: 'error',
        });
      });
  };

  const copySeriesInstanceUIDToClipBoard = () => {
    navigator.clipboard
      .writeText(displaySet['SeriesInstanceUID'])
      .then(() => {
        UINotificationService.show({
          title: 'Copy to Clipboard',
          message: 'Copied SeriesInstanceUID to Clipboard',
          type: 'success',
        });
      })
      .catch((err) => {
        console.error(err);
        UINotificationService.show({
          title: 'Copy to Clipboard',
          message: 'Could not copy SeriesInstanceUID to Clipboard',
          type: 'error',
        });
      });
  };
  const arrowClasses =
    'cursor-pointer shrink-0 mr-2 text-white hover:text-primary-light';

  return (
    <>
      <ViewportActionBar
        onDoubleClick={(evt) => {
          evt.stopPropagation();
          evt.preventDefault();
        }}
        onArrowsClick={(direction) => {
          if (direction === 'down') {
            downloadStudy();
          }
        }}
        getStatusComponent={() => console.log('status')}
        studyData={{
          label: viewportLabel,
          studyDate: formatDate(SeriesDate), // TODO: This is series date. Is that ok?
          currentSeries: SeriesNumber, // TODO - switch entire currentSeries to be UID based or actual position based
          seriesDescription: SeriesDescription,
          patientInformation: {
            patientName: PatientName ? OHIF.utils.formatPN(PatientName) : '',
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
      >
        <Icon
          className={`${arrowClasses}`}
          name="arrow-down"
          onClick={downloadStudy}
        />
        <Icon
          className={`${arrowClasses}`}
          style={{
            height: '16px',
          }}
          name="clipboard"
          onClick={copySeriesInstanceUIDToClipBoard}
        />
      </ViewportActionBar>
      {/* TODO: Viewport interface to accept stack or layers of content like this? */}
      <div className="relative flex flex-row w-full h-full overflow-hidden">
        {getCornerstoneViewport()}
        <div className="absolute w-full">
          {viewportDialogState.viewportId === viewportId && (
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
  viewportId: PropTypes.number.isRequired,
  dataSource: PropTypes.object,
  children: PropTypes.node,
  customProps: PropTypes.object,
};

GradientCornerstoneViewport.defaultProps = {
  customProps: {},
};

export default GradientCornerstoneViewport;
