import { utilities } from '@cornerstonejs/core';

export function getMeasurementImageCoordinates(measurement): {
  topLeft: [number, number];
  bottomRight: [number, number];
} {
  const worldPoints: [number, number, number][] = measurement.points;
  const imageId = measurement.referencedImageId;

  const imagePoints = worldPoints.map((worldPoint) =>
    utilities.worldToImageCoords(imageId, worldPoint)
  );

  const xCoords = imagePoints.map((p) => p[0]);
  const yCoords = imagePoints.map((p) => p[1]);

  const topLeft = [Math.min(...xCoords), Math.min(...yCoords)];
  const bottomRight = [Math.max(...xCoords), Math.max(...yCoords)];

  return {
    topLeft: [Math.round(topLeft[0]), Math.round(topLeft[1])],
    bottomRight: [Math.round(bottomRight[0]), Math.round(bottomRight[1])],
  };
}

export function addAutoPHIBoundingBoxToolLabeler(servicesManager) {
  const { measurementService } = servicesManager.services;
  const phiBoundingBoxToolName = 'PHIBoundingBox';

  measurementService.subscribe(
    measurementService.EVENTS.MEASUREMENT_ADDED,
    ({ measurement }) => {
      if (measurement.toolName !== phiBoundingBoxToolName) {
        return;
      }

      const phiMeasurementsCount = measurementService.getMeasurements(
        (m) => m.toolName === phiBoundingBoxToolName
      ).length;

      measurementService.update(
        measurement.uid,
        {
          ...measurement,
          label: `PHI Bounding Box ${phiMeasurementsCount}`,
        },
        true
      );
    }
  );
}
