import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function DisplayValue({formIndex, name, value, defaultValue, options}) {
  return (
    <Paper sx={{ display: 'flex' }} className='p-2'>
        <Typography sx={{ fontSize: 14, marginRight: 1 }} color="text.secondary" gutterBottom>
          { name }:
        </Typography>
        <Typography variant="body2">
          { value !== null ? value.toString() : defaultValue !== null ? defaultValue.toString() : '' } 
        </Typography>
    </Paper>
  );
}