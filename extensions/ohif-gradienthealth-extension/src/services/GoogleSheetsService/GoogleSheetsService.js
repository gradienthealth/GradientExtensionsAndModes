import { pubSubServiceInterface } from '@ohif/core';
import { alphabet } from "./utils";

const EVENTS = {
    GOOGLE_SHEETS_INIT: 'event::gradienthealth::GoogleSheets:Init',
    GOOGLE_SHEETS_ERROR: 'event::gradienthealth::GoogleSheets:Error',
    GOOGLE_SHEETS_DESTROY: 'event::gradienthealth::GoogleSheets:Destroy',
};

const convertFormValues = (v)=>{
    switch(v){
        case 'TRUE':
            return true
        case 'FALSE':
            return false
        case 'YES':
            return true
        case 'NO':
            return false
        case '':
            return null
        case undefined:
            return null
    }
    return v
};

export default class GoogleSheetsService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.listeners = {};
    this.api_key = 'AIzaSyDu5Rt54oHX1w3O5kZTARz7DClaxNjTpEs' // This is our API key
    this.EVENTS = EVENTS;
    this.sheetId = null
    this.index = null
    this.sheetName = null
    this.formTemplate = null
    this.formValue = null
    Object.assign(this, pubSubServiceInterface);
  }

  async init(){
    try {
        const { UserAuthenticationService } = this.serviceManager.services;
        this.user = UserAuthenticationService.getUser();
        const params = new URLSearchParams(window.location.search)
        
        if(!params.get('sheetId')) return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
        if(!params.get('index')) return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
        if(!params.get('sheetName')) return this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
        this.sheetId = params.get('sheetId')
        this.index = Number(params.get('index'))
        this.sheetName = params.get('sheetName')
        
        // Get settings config from sheets
        const settings = await this.readRange(this.sheetId, 'Settings', 'A1:ZZ6')

        // Get values for current row from sheets
        const formHeader = (await this.readRange(this.sheetId, this.sheetName, 'A1:ZZ1')).values[0]
        const rowValues = (await this.readRange(this.sheetId, this.sheetName, `A${this.index}:ZZ${this.index}`)).values[0]
        this.formHeader = formHeader;

        // Map formTemplate and formValue
        const values = settings.values[0].map((_, colIndex) => settings.values.map(row => row[colIndex]));
        const header = values[0]
        this.formTemplate = values.slice(1,-1).map((col)=>{
            return col.reduce((obj, curr, idx)=>{
                curr = convertFormValues(curr)

                switch(header[idx]){
                    case 'template':
                        try {
                            if(curr) obj[header[idx]] = JSON.parse(curr)
                        } catch(e) {
                            console.warn(curr, e);
                        }                    
                        break;
                    case 'order':
                        obj[header[idx]] = Number(curr)         
                        break;
                    default:
                        obj[header[idx]] = curr
                }
                return obj
            }, {})
        }).filter(ele=>{
            return ele.show
        }).sort((a, b) => a.order - b.order);

        this.formValue = this.readFormValue(rowValues);

        this._broadcastEvent(EVENTS.GOOGLE_SHEETS_INIT);
    } catch(e) {
        this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
    }
  }

  readFormValue(x){
    return this.formTemplate.map((ele)=>{
        const index = this.formHeader.findIndex((name) => name == ele.name)
        if(index !== -1) {
            return convertFormValues(x[index])
        }
    })
  }

  async readRange(sheetId, sheetName, range) {
    let baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}`
    let response = await fetch(baseUrl, { 
        headers: {
            'Authorization': 'Bearer ' + this.user['access_token'],
        }
    });
    let responseJson = await response.json();
    return responseJson
  }

  // Must be XHR to avoid sheets CORS issue
  writeRange(sheetId, sheetName, range, values) {
    return new Promise((resolve, reject)=>{
        let baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}?valueInputOption=USER_ENTERED`
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', baseUrl);
        xhr.setRequestHeader('Content-type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.user['access_token'] );
        xhr.onload = ()=>{
            if(xhr.status == 200) {
                resolve()
            } else {
                reject()
            }
        }
        xhr.send(JSON.stringify({
          "range": `${sheetName}!${range}`,
          "majorDimension": "ROWS",
          "values": [values],
        }));
    })
  }

  async writeFormToRow(formValue){
    const values = this.formHeader.map((colName)=>{
        const index = this.formTemplate.findIndex((ele)=>{ return (colName == ele.name)})
        if(index > 0){
            return formValue[index]
        }

        if(colName === 'Updated By'){
            const user = this.serviceManager.services.UserAuthenticationService.getUser();
            return JSON.stringify({
                'email': user.profile.email,
                'picture': user.profile.picture,
                'lastUpdated': Date.now()
            })
        }
        return null
    });

    await this.writeRange(this.sheetId, this.sheetName, `A${this.index}:${alphabet[this.formHeader.length - 1]}${this.index}`, values);
    return values
  }

  getFormTemplate(){
    return this.formTemplate ? this.formTemplate : null;
  }

  getFormValue(){
    return this.formValue ? this.formValue : null
  }

  async getRow(navigate, delta) {
        try {
            const rowValues = (await this.readRange(this.sheetId, this.sheetName, `A${this.index+delta}:ZZ${this.index+delta}`)).values[0]
            const index = this.formHeader.findIndex((name)=> name == 'URL')
            const url = rowValues[index]
            const host = url.split('://')[1].split('/')[0]
            if (host === window.location.host){
                navigate(url.split(window.location.host)[1])
            } else {
                window.location.href = url
            }
        } catch (e) {
            console.error(e)
            try {
                window.location.href = url
            } catch (e){
                window.location.href = `https://docs.google.com/spreadsheets/d/${this.sheetId}`
            }
        }
  }

  destroy() {
    this.sheetId = null
    this.index = null
    this.sheetName = null
    this.formTemplate = null
    this.formValue = null
    this._broadcastEvent(EVENTS.GOOGLE_SHEETS_ERROR);
  }
}
