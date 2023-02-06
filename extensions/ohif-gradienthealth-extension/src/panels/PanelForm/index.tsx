import React, { useEffect, useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import FormGeneratorComponent from '../../_shared/FormGeneratorComponent';
import LinearProgress from '@mui/material/LinearProgress';
import LoadingButton from '@mui/lab/LoadingButton';
import ArrowForward from '@mui/icons-material/ArrowForward';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import debounce from 'lodash.debounce';

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

function PanelForm({ servicesManager, extensionManager }) {
  const { GoogleSheetsService } = servicesManager.services
  const [formTemplate, setFormTemplate] = useState(GoogleSheetsService.getFormTemplate());
  const [formValue, setFormValue] = useState(GoogleSheetsService.getFormValue());
  const [error, setError] = useState(false);
  const prevFormValue = usePrevious(formValue);
  const [initLoading, setInitLoading] = useState(!Boolean(formValue && formTemplate));
  const [loading, setLoading] = useState(false);
  const onNext = ()=> GoogleSheetsService.getRow(1)
  const onPrevious = ()=> GoogleSheetsService.getRow(-1)
  const debouncedOnNext = useMemo(() => debounce(onNext, 300), []);
  const debouncedOnPrevious = useMemo(() => debounce(onPrevious, 300), []);

  useEffect(() => {
    const subscriptions = [];
    subscriptions.push(
      GoogleSheetsService.subscribe(GoogleSheetsService.EVENTS.GOOGLE_SHEETS_CHANGE, () => {
        setFormValue(GoogleSheetsService.getFormValue())
        setFormTemplate(GoogleSheetsService.getFormTemplate())
        setInitLoading(false)
      }).unsubscribe
    );

    subscriptions.push(
      GoogleSheetsService.subscribe(GoogleSheetsService.EVENTS.GOOGLE_SHEETS_ERROR, () => {
        setError(true)
      }).unsubscribe
    );
    return () => { subscriptions.forEach(unsub=>unsub()) };
  }, [GoogleSheetsService]);

  useEffect(() => {
    if(prevFormValue){
      setLoading(true)
      GoogleSheetsService.writeFormToRow(formValue).then((values)=>{
        setLoading(false)
      })
    }
  }, [formValue]);

  if(error){
    return (
      <Paper sx={{ display: 'flex' }} className='p-2'>
          <Typography sx={{ fontSize: 14, marginRight: 1 }} color="text.secondary" gutterBottom>
            { "There was an error connecting to Google Sheets." }
          </Typography>
      </Paper>
    )
  }

  if(!initLoading){
    return (
      <> 
        <div style={{color:"white", overflow: "auto"}}>
            { loading ? <LinearProgress/> : <div style={{height: '4px'}}></div> }
            <FormGeneratorComponent
                formTemplate={formTemplate} 
                formValue={formValue}
                setFormValue={setFormValue}/>
        </div>
        <div className="flex justify-center p-4">
          <Paper>
            <ButtonGroup variant="contained" aria-label="outlined primary button group">
              <LoadingButton
                loading={loading}
                loadingPosition="start"
                startIcon={<ArrowBack />}
                variant="contained"
                color="primary"
                onClick={debouncedOnPrevious}
              >
                Prev
              </LoadingButton>
              <LoadingButton
                loading={loading}
                loadingPosition="end"
                endIcon={<ArrowForward />}
                variant="contained"
                color="primary"
                onClick={debouncedOnNext}
              >
                Next
              </LoadingButton>
            </ButtonGroup>
          </Paper>
        </div>
      </>
    )
  }
  
  return <LinearProgress/>
}

PanelForm.propTypes = {
  servicesManager: PropTypes.shape({
    services: PropTypes.shape({
    }).isRequired,
  }).isRequired,
};

export default PanelForm;
