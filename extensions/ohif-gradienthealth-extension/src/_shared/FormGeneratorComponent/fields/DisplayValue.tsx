import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function DisplayValue({
  name,
  value,
  defaultValue,
}: {
  name: string;
  value: string | null;
  defaultValue: string | null;
}) {
  return (
    <Paper sx={{ display: 'flex' }} className="p-2">
      <Typography
        sx={{ fontSize: 14, marginRight: 1 }}
        color="text.secondary"
        gutterBottom
      >
        {name}:
      </Typography>
      <Typography
        variant="body2"
        className="overflow-y-auto invisible-scrollbar"
      >
        {value !== null
          ? value.toString()
          : defaultValue !== null
            ? defaultValue.toString()
            : ''}
      </Typography>
    </Paper>
  );
}
