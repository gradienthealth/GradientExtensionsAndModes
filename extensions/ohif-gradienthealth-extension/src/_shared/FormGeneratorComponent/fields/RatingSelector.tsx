import * as React from 'react';
import Rating from '@mui/material/Rating';
import Paper from '@mui/material/Paper';
import StarIcon from '@mui/icons-material/Star';
import Typography from '@mui/material/Typography';

export default function RatingSelector({ formIndex, name, value, defaultValue, options, onChange }) {
  const { labels, precision, max } = options

  const getKeyFromValue = (v)=>{
    if(v == null) return null

    const obj = Object.keys(labels).map((key, idx)=>{
      return {key: key, value: labels[key].value}
    }).find((ele)=>{
      return ele.value == v
    })

    if(obj) return Number(obj.key)
    return null
  }

  const [val, setVal] = React.useState(value !== null ? getKeyFromValue(value): getKeyFromValue(defaultValue));  
  const [hover, setHover] = React.useState(-1);

  return (
    <Paper className='p-2'>
      <div>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          { name }
        </Typography>
        <Typography variant="h6" component="div">
          { (val !== null || hover !== -1) ? labels[hover !== -1 ? hover : val].value : '?' }
        </Typography>
        <Typography variant="body2">
          { (val !== null || hover !== -1) ? labels[hover !== -1 ? hover : val].description : 'Please Select'}
        </Typography>
      </div>
      <Rating
        name="hover-feedback"
        value={val}
        precision={precision}
        max={max}
        onChange={(event, newValue) => {
          onChange({ formIndex: formIndex, value: newValue ? labels[newValue].value : newValue })
          setVal(newValue);
        }}
        onChangeActive={(event, newHover) => {
          setHover(newHover);
        }}
        emptyIcon={<StarIcon style={{ opacity: 0.55 }} fontSize="inherit" />}
      />
    </Paper>
  );
}
