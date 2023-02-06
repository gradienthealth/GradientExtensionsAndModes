import * as React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';

export default function GridSelector({ formIndex, name, value, defaultValue, options, onChange }) {
  const { labels, cols } = options
  const [val, setVal] = React.useState(value !== null ? value : defaultValue);  
  React.useEffect(()=>{
    setVal(value !== null ? value : defaultValue)
  }, [value])

  return (
    <Paper className='p-2'>
      <div>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          { name }
        </Typography>
        <Typography variant="body2" component="div">
          { Boolean(labels.find(ele=>(ele.value==val)))  ? labels.find(ele=>(ele.value==val)).description : '?' }
        </Typography>
      </div>
      { 
        labels.reduce((all,one,i) => {
           const ch = Math.floor(i/(cols || 3)); 
           all[ch] = [].concat((all[ch]||[]),one); 
           return all
        }, []).map((chunk, idx) => {
          return <RadioGroup
            row
            key={idx}
            name="grid-select-row"
            value={val}
            onChange={(event, newValue) => {
              onChange({ formIndex: formIndex, value: newValue})
              setVal(newValue);
            }}
          >
            {
              chunk.map((label, idx) => {
                return <FormControlLabel key={idx} value={label.value} control={<Radio />} label={label.value} />
              })
            }
          </RadioGroup>
        })
      }
    </Paper>
  );
}