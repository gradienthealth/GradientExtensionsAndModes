# @gradienthealth&#x2F;ohif-gradienthealth-extension

### Segmentation in DicomJson Series metadata Sample

```json
{
  "Modality": "SEG",
  "SeriesInstanceUID": "2.25.478875556728379505207796619011601982565",
  "SeriesDescription": "Seg2",
  "SeriesNumber": 99,
  "SeriesDate": "20231109",
  "StudyInstanceUID": "1.2.40.1.13.2.1464541835.1640.1480008284780.704.2.0",
  "instances": [
    {
      "metadata": {
        "FrameOfReferenceUID": "1.3.46.670589.11.18776.5.0.6996.2016112418000306013",
        "SOPInstanceUID": "2.25.381554502573666068693329632131787392307",
        "SOPClassUID": "1.2.840.10008.5.1.4.1.1.66.4",
        "ReferencedSeriesSequence": {
          "SeriesInstanceUID": "1.3.46.670589.11.18776.5.0.6088.2016112418015260387",
          "ReferencedInstanceSequence": [
            {
              "ReferencedSOPClassUID": "1.2.840.10008.5.1.4.1.1.4",
              "ReferencedSOPInstanceUID": "1.3.46.670589.11.18776.5.0.6088.2016112418034896398"
            },
            {
              "ReferencedSOPClassUID": "1.2.840.10008.5.1.4.1.1.4",
              "ReferencedSOPInstanceUID": "1.3.46.670589.11.18776.5.0.6088.2016112418052378421"
            },
            {
              "ReferencedSOPClassUID": "1.2.840.10008.5.1.4.1.1.4",
              "ReferencedSOPInstanceUID": "1.3.46.670589.11.18776.5.0.6088.2016112418034934404"
            },
            {
              "ReferencedSOPClassUID": "1.2.840.10008.5.1.4.1.1.4",
              "ReferencedSOPInstanceUID": "1.3.46.670589.11.18776.5.0.6088.2016112418052326410"
            }
          ]
        },
        "SharedFunctionalGroupsSequence": {
          "PlaneOrientationSequence": {
            "ImageOrientationPatient": [
              0.06783646345138, 0.99748069047927, 0.02074741572141,
              -0.0216917078942, 0.02226497046649, -0.9995167255401
            ]
          },
          "PixelMeasuresSequence": {
            "PixelSpacing": [0.265625, 0.265625],
            "SliceThickness": 4.099999453351714
          },
          "MRImageFrameTypeSequence": {
            "FrameType": ["ORIGINAL", "PRIMARY", "OTHER", "NONE"],
            "PixelPresentation": "MONOCHROME",
            "VolumetricProperties": "VOLUME",
            "VolumeBasedCalculationTechnique": "NONE",
            "ComplexImageComponent": "MAGNITUDE",
            "AcquisitionContrast": "UNKNOWN"
          }
        }
      },
      "url": "dicomweb:https://storage.googleapis.com/gradient-health-dicomseg/dicomweb/studies/1.2.40.1.13.2.1464541835.1640.1480008284780.704.2.0/series/2.25.478875556728379505207796619011601982565/instances/2.25.381554502573666068693329632131787392307/Seg2.dcm"
    }
  ]
}
```

Segmentation Series metedata is also retrieved along with other series metadata
and loaded as Segmentation
