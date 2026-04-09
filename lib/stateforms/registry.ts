import 'server-only';

import { indianaStateForm } from '@/lib/stateforms/indiana';
import { michiganStateForm } from '@/lib/stateforms/michigan';
import { ohioStateForm } from '@/lib/stateforms/ohio';
import { normalizeStateFormType } from '@/lib/stateforms/catalog';
import { StateFormDefinition, StateFormType } from '@/lib/stateforms/types';

const registry: Record<StateFormType, StateFormDefinition> = {
  indiana: indianaStateForm,
  ohio: ohioStateForm,
  michigan: michiganStateForm,
};

export function getStateFormDefinition(type: any): StateFormDefinition {
  return registry[normalizeStateFormType(type)];
}
