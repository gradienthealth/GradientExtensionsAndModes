import * as React from 'react';
import { useMemo } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import debounce from 'lodash.debounce';

export default function Textarea({formIndex, name, value, defaultValue, options, onChange}) {
  const [val, setVal] = React.useState(value !== null ? value : (defaultValue !== null ? defaultValue : ''));  
  const { rows } = options
  const debouncedOnChange = useMemo(
    () => debounce((formIndex, value) => {
      onChange({formIndex, value})
    }, 600), [onChange]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVal(event.target.value);
    debouncedOnChange(formIndex, event.target.value)
  };

  return (
    <Paper className='p-2'>
      <TextField
        id="outlined-multiline-flexible"
        inputProps={{style: {fontSize: '0.75em'}}}
        label={name}
        multiline
        rows={ rows }
        value={val}
        fullWidth={true}
        margin={'dense'}
        size={'small'}
        onChange={handleChange}
      />
    </Paper>
  );
}