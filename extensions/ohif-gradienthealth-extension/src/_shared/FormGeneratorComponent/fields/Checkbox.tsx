import * as React from 'react';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function CheckboxLabels({
  formIndex,
  name,
  value,
  defaultValue,
  onChange,
}: {
  formIndex: number;
  name: string;
  value: string | boolean | null;
  defaultValue: string | null;
  onChange: ({
    formIndex,
    value,
  }: {
    formIndex: number;
    value: boolean;
  }) => void;
}) {
  let checked;
  if (value !== null) {
    checked = Boolean(value);
  } else {
    checked = Boolean(defaultValue);
    onChange({ formIndex: formIndex, value: checked });
  }

  return (
    <Paper className="p-2">
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={checked}
              onChange={(evt) =>
                onChange({ formIndex: formIndex, value: evt.target.checked })
              }
            />
          }
          label={
            <Typography variant="body2" color="textSecondary">
              {name}
            </Typography>
          }
        />
      </FormGroup>
    </Paper>
  );
}
