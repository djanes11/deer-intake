import { StateFormType } from '@/lib/stateforms/types';

export function normalizeStateFormType(value: any): StateFormType {
  return value === 'ohio' || value === 'michigan' || value === 'indiana' ? value : 'indiana';
}

export function listStateFormOptions() {
  return [
    { value: 'indiana', label: 'Indiana DNR Processor Record' },
    { value: 'ohio', label: 'Ohio DNR 8812 Processor Record' },
    { value: 'michigan', label: 'Michigan Wild Game Processor Report' },
  ] as const;
}
