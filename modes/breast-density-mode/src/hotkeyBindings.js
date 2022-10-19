import windowLevelPresets from './windowLevelPresets';

/*
 * Supported Keys: https://craig.is/killing/mice
 */
const bindings = [
  {
    commandName: 'setToolActive',
    commandOptions: { toolName: 'Zoom' },
    label: 'Zoom',
    keys: ['z'],
    isEditable: true,
  },
  {
    commandName: 'scaleUpViewport',
    label: 'Zoom In',
    keys: ['+'],
    isEditable: true,
  },
  {
    commandName: 'scaleDownViewport',
    label: 'Zoom Out',
    keys: ['-'],
    isEditable: true,
  },
  {
    commandName: 'fitViewportToWindow',
    label: 'Zoom to Fit',
    keys: ['='],
    isEditable: true,
  },
  {
    commandName: 'rotateViewportCW',
    label: 'Rotate Right',
    keys: ['r'],
    isEditable: true,
  },
  {
    commandName: 'rotateViewportCCW',
    label: 'Rotate Left',
    keys: ['l'],
    isEditable: true,
  },
  {
    commandName: 'flipViewportHorizontal',
    label: 'Flip Horizontally',
    keys: ['h'],
    isEditable: true,
  },
  {
    commandName: 'flipViewportVertical',
    label: 'Flip Vertically',
    keys: ['v'],
    isEditable: true,
  },
  {
    commandName: 'toggleCine',
    label: 'Cine',
    keys: ['c'],
  },
  {
    commandName: 'invertViewport',
    label: 'Invert',
    keys: ['i'],
    isEditable: true,
  },
  {
    commandName: 'incrementActiveViewport',
    label: 'Next Image Viewport',
    keys: ['right'],
    isEditable: true,
  },
  {
    commandName: 'decrementActiveViewport',
    label: 'Previous Image Viewport',
    keys: ['left'],
    isEditable: true,
  },
  {
    commandName: 'nextViewportDisplaySet',
    label: 'Next Series',
    keys: ['pageup'],
    isEditable: true,
  },
  {
    commandName: 'previousViewportDisplaySet',
    label: 'Previous Series',
    keys: ['pagedown'],
    isEditable: true,
  },
  {
    commandName: 'nextImage',
    label: 'Next Image',
    keys: ['down'],
    isEditable: true,
  },
  {
    commandName: 'previousImage',
    label: 'Previous Image',
    keys: ['up'],
    isEditable: true,
  },
  {
    commandName: 'firstImage',
    label: 'First Image',
    keys: ['home'],
    isEditable: true,
  },
  {
    commandName: 'lastImage',
    label: 'Last Image',
    keys: ['end'],
    isEditable: true,
  },
  {
    commandName: 'resetViewport',
    label: 'Reset',
    keys: ['space'],
    isEditable: true,
  },
  {
    commandName: 'cancelMeasurement',
    label: 'Cancel Cornerstone Measurement',
    keys: ['esc'],
  },
  {
    commandName: 'setWindowLevel',
    commandOptions: windowLevelPresets[1],
    label: 'W/L Preset 1',
    keys: ['1'],
  },
  {
    commandName: 'setWindowLevel',
    commandOptions: windowLevelPresets[2],
    label: 'W/L Preset 2',
    keys: ['2'],
  },
  {
    commandName: 'setWindowLevel',
    commandOptions: windowLevelPresets[3],
    label: 'W/L Preset 3',
    keys: ['3'],
  }
];

export default bindings;
