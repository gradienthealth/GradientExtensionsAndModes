import { normalizers } from 'dcmjs';
import { metaData } from '@cornerstonejs/core';

const { Normalizer, ImageNormalizer } = normalizers;

export default function overrideNormalizer() {
  class SingleSliceImageNormalizer extends ImageNormalizer {
    normalize() {
      this.dataset = getHandledSingleImageDataset(this.datasets[0], metaData);
      super.normalizeMultiframe();
    }
  }

  const XAImageNormalizer = SingleSliceImageNormalizer;
  const MGImageNormalizer = SingleSliceImageNormalizer;
  const USImageNormalizer = SingleSliceImageNormalizer;
  const CRImageNormalizer = SingleSliceImageNormalizer;

  class SecondaryCapturedImageNormalizer extends ImageNormalizer {
    normalize() {
      let normalizerClass: { new (datasets) };
      switch (this.dataSets[0].Modality) {
        case 'MG':
          normalizerClass = Normalizer.normalizerForSOPClassUID(
            '1.2.840.10008.5.1.4.1.1.1.2'
          );
          break;
        case 'XA':
          normalizerClass = Normalizer.normalizerForSOPClassUID(
            '1.2.840.10008.5.1.4.1.1.12.1'
          );
          break;
        case 'US':
          normalizerClass = Normalizer.normalizerForSOPClassUID(
            '1.2.840.10008.5.1.4.1.1.6.1'
          );
          break;
        case 'CR':
          normalizerClass = Normalizer.normalizerForSOPClassUID(
            '1.2.840.10008.5.1.4.1.1.1'
          );
          break;
        default:
          super.normalize();
          return;
      }

      const normalizer = new normalizerClass(this.dataSets);
      normalizer.normalize();
    }
  }

  const SingleImageSOPClassUIDMap: Record<string, any> = {
    '1.2.840.10008.5.1.4.1.1.1.2': MGImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.1.2.1': MGImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.13.1.3': MGImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.12.1': XAImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.7': SecondaryCapturedImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.6.1': USImageNormalizer,
    '1.2.840.10008.5.1.4.1.1.1': CRImageNormalizer,
  };

  const parentNormalizerForSOPClassUID = Normalizer.normalizerForSOPClassUID;
  Normalizer.normalizerForSOPClassUID = (sopClassUID: string) => {
    const normalizerClass = parentNormalizerForSOPClassUID(sopClassUID);

    if (normalizerClass) {
      return normalizerClass;
    } else if (SingleImageSOPClassUIDMap[sopClassUID]) {
      return SingleImageSOPClassUIDMap[sopClassUID];
    }
  };
}

function getHandledSingleImageDataset(dataset, metaData) {
  const { rowCosines, columnCosines } = metaData.get(
    'imagePlaneModule',
    dataset.imageId
  );

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
        ...rowCosines,
        ...columnCosines,
      ],
    },
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
