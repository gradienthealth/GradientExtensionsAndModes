import React from 'react';
import RatingSelector from './fields/RatingSelector'
import GridSelector from './fields/GridSelector'
import Checkbox from './fields/Checkbox'
import Textarea from './fields/Textarea'
import DisplayValue from './fields/DisplayValue'
import UserProfile from './fields/UserProfile'

function FormGeneratorComponent({ formTemplate, formValue, setFormValue }) {

  const onChangeHandler = ({formIndex, value}) => {
    const newFormValue = [...formValue]
    newFormValue[formIndex] = value
    setFormValue([...newFormValue]);
  }
  
  if(formTemplate){
    // We assume a valid formTemplate
    const inputs = formTemplate.map((ele, idx) => {
      switch(ele.type) {
        case 'checkbox':
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <Checkbox formIndex={idx} name={ele.name} options={ele.template} defaultValue={ele.defaultValue} value={formValue[idx]} onChange={onChangeHandler}/>
            </div>
          )
        case 'rating':
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <RatingSelector formIndex={idx} name={ele.name} options={ele.template} defaultValue={ele.defaultValue} value={formValue[idx]} onChange={onChangeHandler}/>
            </div>
          )
        case 'grid':
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <GridSelector formIndex={idx} name={ele.name} options={ele.template} defaultValue={ele.defaultValue} value={formValue[idx]} onChange={onChangeHandler}/>
            </div>
          )
        case 'textarea':
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <Textarea formIndex={idx} name={ele.name} options={ele.template} defaultValue={ele.defaultValue} value={formValue[idx]} onChange={onChangeHandler}/>
            </div>
          )
        case 'user_profile':
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <UserProfile value={formValue[idx]}/>
            </div>
          )
        default:
          return (
            <div key={idx} className="p-2 bg-primary-dark">
              <DisplayValue formIndex={idx} name={ele.name} options={ele.template} defaultValue={ele.defaultValue} value={formValue[idx]}/>
            </div>
          )      
      }
    })

    return (<div>
      {inputs}
    </div>)
  }

  return null
}

export default FormGeneratorComponent;
