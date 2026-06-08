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

      const otherPhiMeasurements = measurementService.getMeasurements(
        // Exclude the current measurement to avoid self-referencing during the add event
        (m) =>
          m.toolName === phiBoundingBoxToolName && m.uid !== measurement.uid
      );

      const usedIndices = new Set();
      otherPhiMeasurements.forEach((m) => {
        const match = m.label && m.label.match(/PHI Bounding Box (\d+)/);
        if (match) {
          usedIndices.add(parseInt(match[1], 10));
        }
      });

      let nextIndex = 1;
      while (usedIndices.has(nextIndex)) {
        nextIndex++;
      }

      measurementService.update(
        measurement.uid,
        { ...measurement, label: `PHI Bounding Box ${nextIndex}` },
        true
      );
    }
  );
}
