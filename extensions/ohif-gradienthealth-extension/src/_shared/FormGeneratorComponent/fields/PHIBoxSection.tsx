import React from 'react';
import { useToolbar } from '@ohif/core';
import { Button, ToolButton } from '@ohif/ui-next';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useSystem } from '@ohif/core';

import { getMeasurementImageCoordinates } from '../../../utils/phiBoundingBoxMeasurementUtils';

export default function PHIBoxSection({ formIndex, name, value, onChange }) {
  const { servicesManager } = useSystem();
  const { measurementService, toolGroupService, viewportGridService } =
    servicesManager.services;
  const phiBoundingBoxToolName = 'PHIBoundingBox';
  const { onInteraction, toolbarButtons } = useToolbar({
    buttonSection: phiBoundingBoxToolName,
  });

  const toolGroup = toolGroupService.getToolGroupForViewport(
    viewportGridService.getActiveViewportId()
  );

  const handleSave = () => {
    const phiBoundingBoxMeasurements = measurementService.getMeasurements(
      (m) => m.toolName === phiBoundingBoxToolName
    );

    if (!phiBoundingBoxMeasurements.length) {
      onChange({ formIndex, value: '' });
      return;
    }

    const newValue: Record<
      string,
      Array<[[number, number], [number, number]]>
    > = {};

    phiBoundingBoxMeasurements.forEach((m) => {
      const imageId = m.referencedImageId.replace(/^.*?:\s*/, ''); // Remove the 'cod:' prefix
      const imageCoords = getMeasurementImageCoordinates(m);

      if (!newValue[imageId]) {
        newValue[imageId] = [[imageCoords.topLeft, imageCoords.bottomRight]];
      } else {
        newValue[imageId].push([imageCoords.topLeft, imageCoords.bottomRight]);
      }
    });

    onChange({ formIndex, value: JSON.stringify(newValue) });
  };

  const handleClear = () => {
    measurementService.clearMeasurements();
  };

  // Find the tool configuration
  const phiBoundingBoxTool = toolbarButtons.find(
    (b) => b.id === phiBoundingBoxToolName
  );
  const { commands, icon, label, isActive } =
    phiBoundingBoxTool?.componentProps || {};

  if (!toolGroup?.hasTool(phiBoundingBoxToolName)) {
    return null;
  }

  return (
    <Paper className="p-2 gap-3">
      <div>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          {name}
        </Typography>
      </div>
      {phiBoundingBoxTool ? (
        <ToolButton
          size="small"
          icon={icon}
          label={label}
          isActive={isActive}
          className={isActive ? 'bg-highlight' : 'bg-secondary-dark'}
          onInteraction={(event) => {
            onInteraction?.({
              event,
              id: phiBoundingBoxTool?.id,
              commands: commands,
              itemId: phiBoundingBoxTool?.id,
              item: phiBoundingBoxTool,
            });
          }}
        />
      ) : (
        <div className="text-xs text-secondary-light">Tool Not Found</div>
      )}

      <div className="flex mt-1">
        <Button
          variant="outline"
          onClick={handleSave}
          className="min-w-[100px] bg-primary-dark hover:bg-primary-main hover:text-black"
        >
          Update
        </Button>

        <Button
          variant="outline"
          onClick={handleClear}
          className="ml-2 min-w-[100px] bg-primary-dark hover:bg-primary-main hover:text-black"
        >
          Clear
        </Button>
      </div>
    </Paper>
  );
}
