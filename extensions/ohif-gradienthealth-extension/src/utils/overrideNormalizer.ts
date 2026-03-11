import { normalizers } from 'dcmjs';

const { SEGImageNormalizer } = normalizers;

export default function overrideNormalizer() {
  const originalNormalize = SEGImageNormalizer.prototype.normalize;

  function customNormalize() {
    if (this.datasets.length === 1) {
      this.dataset = getHandledSingleImageDataset(this.datasets[0]);
      this.normalizeMultiframe();
    } else {
      this.datasets = this.datasets.map((dataset) =>
        getHandledSingleImageDataset(dataset)
      );
      originalNormalize.call(this);
    }
  }

  const XAImageNormalize = customNormalize;
  const MGImageNormalize = customNormalize;
  const USImageNormalize = customNormalize;
  const CRImageNormalize = customNormalize;

  function secondaryCaptureNormalize() {
    let normalizerFunction: () => void;
    switch (this.dataSets[0].Modality) {
      case 'MG':
        normalizerFunction = MGImageNormalize;
        break;
      case 'XA':
        normalizerFunction = XAImageNormalize;
        break;
      case 'US':
        normalizerFunction = USImageNormalize;
        break;
      case 'CR':
        normalizerFunction = CRImageNormalize;
        break;
      default:
        customNormalize();
        return;
    }
    normalizerFunction();
  }

  const CustomSOPClassUIDMap: Record<string, () => void> = {
    '1.2.840.10008.5.1.4.1.1.1.2': MGImageNormalize,
    '1.2.840.10008.5.1.4.1.1.1.2.1': MGImageNormalize,
    '1.2.840.10008.5.1.4.1.1.13.1.3': MGImageNormalize,
    '1.2.840.10008.5.1.4.1.1.12.1': XAImageNormalize,
    '1.2.840.10008.5.1.4.1.1.7': secondaryCaptureNormalize,
    '1.2.840.10008.5.1.4.1.1.6.1': USImageNormalize,
    '1.2.840.10008.5.1.4.1.1.1': CRImageNormalize,
  };

  SEGImageNormalizer.prototype.normalize = function () {
    if (CustomSOPClassUIDMap[this.datasets[0].SOPClassUID]) {
      const normalizeFn = CustomSOPClassUIDMap[this.datasets[0].SOPClassUID];
      normalizeFn.call(this);
    } else {
      originalNormalize.call(this);
    }
  };
}

function getHandledSingleImageDataset(dataset) {
  const { RowCosines, ColumnCosines } = dataset;

  const PerFrameFunctionalGroupsSequence = {
    PlanePositionSequence: {
      ImagePositionPatient: dataset.ImagePositionPatient || [0, 0, 0],
    },
    FrameVOILUTSequence: {
      WindowCenter: dataset.WindowCenter,
      WindowWidth: dataset.WindowWidth,
    },
    PlaneOrientationSequence: {
      ImageOrientationPatient: dataset.ImageOrientationPatient || [
        ...RowCosines,
        ...ColumnCosines,
      ],
    },
    FrameContentSequence: {},
  };

  return {
    ...dataset,
    ReferencedSeriesSequence: {
      SeriesInstanceUID: dataset.SeriesInstanceUID,
      ReferencedInstanceSequence: [
        {
          ReferencedSOPClassUID: dataset.SOPClassUID,
          ReferencedSOPInstanceUID: dataset.SOPInstanceUID,
        },
      ],
    },
    SharedFunctionalGroupsSequence: {
      PlaneOrientationSequence: {
        ImageOrientationPatient: dataset.ImageOrientationPatient || [
          ...rowCosines,
          ...columnCosines,
        ],
      },
      PixelMeasuresSequence: {
        PixelSpacing: dataset.PixelSpacing,
        SpacingBetweenSlices: 0,
        SliceThickness: 0,
      },
      PixelValueTransformationSequence: {
        RescaleIntercept: dataset.RescaleIntercept,
        RescaleSlope: dataset.RescaleSlope,
        RescaleType: dataset.RescaleType,
      },
    },
    PerFrameFunctionalGroupsSequence:
      dataset.NumberOfFrames > 1
        ? Array(dataset.NumberOfFrames).fill(PerFrameFunctionalGroupsSequence)
        : PerFrameFunctionalGroupsSequence,
    NumberOfFrames: dataset.NumberOfFrames || 1,
    ImageOrientationPatient: dataset.ImageOrientationPatient || [
      ...rowCosines,
      ...columnCosines,
    ],
    ImagePositionPatient: dataset.ImagePositionPatient || [0, 0, 0],
  };
}
