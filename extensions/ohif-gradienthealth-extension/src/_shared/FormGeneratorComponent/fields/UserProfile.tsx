import * as React from 'react';
import Paper from '@mui/material/Paper';
import CardHeader from '@mui/material/CardHeader';
import Avatar from '@mui/material/Avatar';

function dhm(t) {
    var cd = 24 * 60 * 60 * 1000,
        ch = 60 * 60 * 1000,
        d = Math.floor(t / cd),
        h = Math.floor( (t - d * cd) / ch),
        m = Math.round( (t - d * cd - h * ch) / 60000)
  if( m === 60 ){
    h++;
    m = 0;
  }
  if( h === 24 ){
    d++;
    h = 0;
  }
  return [d, h, m]
}

export default function UserProfile({value}) {
    const getDateText = (lastUpdated) => {
        const [days, hours, minutes] = dhm(Date.now() - lastUpdated)

        if(days > 7){
            return (new Date(lastUpdated)).toLocaleDateString('en-us', { year:"numeric", month:"short", day:"numeric"})
        }
        if(days > 2){
            return `${days} days ago`
        }
        if(hours > 2){
            return `${hours} hours ago`
        }
        if(minutes > 2){
            return `${minutes} mins ago`
        }
        return `just now`
    }

    try{
        value = JSON.parse(value)
    } catch (e){
        console.error(e, value)
        value = null
    }
    
    if(value){
        return (
            <Paper>
                <CardHeader
                    sx={{
                        "& .MuiCardHeader-content": {
                            overflow: "hidden"
                        }
                    }}
                    avatar={
                        <Avatar 
                            imgProps={{
                                crossOrigin: "anonymous",
                                referrerPolicy: "no-referrer"
                            }}
                            src={ value.picture }/>
                    }
                    title={ value.email }
                    subheader={ `Updated ${getDateText(value.lastUpdated)}` }
                />
            </Paper>
        );
    }
    return (
        <Paper>
            <CardHeader
                sx={{
                    "& .MuiCardHeader-content": {
                        overflow: "hidden"
                    }
                }}
                avatar={
                    <Avatar/>
                }
                title={ '----' }
                subheader={ `No last update` }
            />
        </Paper>
    )
}