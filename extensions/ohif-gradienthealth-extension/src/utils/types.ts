import { MODIFYING_BUTTONS } from './constants';

export type ToolButton = {
  id: keyof typeof MODIFYING_BUTTONS;
  props: Record<string, any>;
  uiType: string;
};
