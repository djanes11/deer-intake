import type { PublicCopySettings } from '@/lib/siteSettings';

export type ConfirmationValidation = 'exact_13' | 'digits_only' | 'freeform';
export type TagFormat = 'digits_only' | 'letters_numbers';

export type IdentifierSettings = {
  confirmationLabel: string;
  confirmationPlaceholder: string;
  confirmationValidation: ConfirmationValidation;
  tagLabel: string;
  tagPlaceholder: string;
  tagFormat: TagFormat;
  tagMinLength: number;
  startingTagNumber: string;
};

const DEFAULT_IDENTIFIER_SETTINGS: IdentifierSettings = {
  confirmationLabel: 'Confirmation #',
  confirmationPlaceholder: 'State confirmation #',
  confirmationValidation: 'exact_13',
  tagLabel: 'Tag Number',
  tagPlaceholder: 'Deer tag number',
  tagFormat: 'digits_only',
  tagMinLength: 5,
  startingTagNumber: '1000',
};

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function identifierSettingsFromPublicCopy(copy?: Partial<PublicCopySettings> | null): IdentifierSettings {
  return {
    confirmationLabel: String(copy?.confirmationLabel || '').trim() || DEFAULT_IDENTIFIER_SETTINGS.confirmationLabel,
    confirmationPlaceholder: String(copy?.confirmationPlaceholder || '').trim() || DEFAULT_IDENTIFIER_SETTINGS.confirmationPlaceholder,
    confirmationValidation:
      copy?.confirmationValidation === 'digits_only' || copy?.confirmationValidation === 'freeform'
        ? copy.confirmationValidation
        : DEFAULT_IDENTIFIER_SETTINGS.confirmationValidation,
    tagLabel: String(copy?.tagLabel || '').trim() || DEFAULT_IDENTIFIER_SETTINGS.tagLabel,
    tagPlaceholder: String(copy?.tagPlaceholder || '').trim() || DEFAULT_IDENTIFIER_SETTINGS.tagPlaceholder,
    tagFormat: copy?.tagFormat === 'letters_numbers' ? 'letters_numbers' : DEFAULT_IDENTIFIER_SETTINGS.tagFormat,
    tagMinLength: Math.min(12, Math.max(1, Number(copy?.tagMinLength || DEFAULT_IDENTIFIER_SETTINGS.tagMinLength) || DEFAULT_IDENTIFIER_SETTINGS.tagMinLength)),
    startingTagNumber: String(copy?.startingTagNumber || '').trim() || DEFAULT_IDENTIFIER_SETTINGS.startingTagNumber,
  };
}

export function normalizeConfirmationInput(value: string, settings: IdentifierSettings) {
  if (settings.confirmationValidation === 'freeform') {
    return String(value || '').replace(/\s+/g, ' ').trimStart().slice(0, 40);
  }
  const digits = digitsOnly(value);
  if (settings.confirmationValidation === 'exact_13') return digits.slice(0, 13);
  return digits.slice(0, 24);
}

export function validateConfirmation(value: string, settings: IdentifierSettings) {
  const normalized = normalizeConfirmationInput(value, settings).trim();
  if (!normalized) return `${settings.confirmationLabel} is required`;
  if (settings.confirmationValidation === 'exact_13' && normalized.length !== 13) {
    return `${settings.confirmationLabel} must be 13 digits`;
  }
  if (settings.confirmationValidation === 'digits_only' && !/^\d+$/.test(normalized)) {
    return `${settings.confirmationLabel} must use digits only`;
  }
  return '';
}

export function confirmationInputMode(settings: IdentifierSettings): 'numeric' | 'text' {
  return settings.confirmationValidation === 'freeform' ? 'text' : 'numeric';
}

export function confirmationSearchCandidates(value: string, settings: IdentifierSettings): string[] {
  const normalized = normalizeConfirmationInput(value, settings).trim();
  if (!normalized) return [];
  if (settings.confirmationValidation === 'freeform') return [normalized];
  const digits = digitsOnly(normalized);
  return Array.from(
    new Set([
      digits,
      digits.length > 6 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : '',
    ].filter(Boolean))
  );
}

export function normalizeTagInput(value: string, settings: IdentifierSettings) {
  const raw = String(value || '').trim().toUpperCase();
  if (settings.tagFormat === 'letters_numbers') {
    return raw.replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  }
  return digitsOnly(raw).slice(0, 20);
}

export function validateTag(value: string, settings: IdentifierSettings, required = true) {
  const normalized = normalizeTagInput(value, settings);
  if (!normalized) {
    return required ? `${settings.tagLabel} is required` : '';
  }
  if (normalized.length < settings.tagMinLength) {
    return `${settings.tagLabel} must be at least ${settings.tagMinLength} characters`;
  }
  return '';
}

export function tagInputMode(settings: IdentifierSettings): 'numeric' | 'text' {
  return settings.tagFormat === 'letters_numbers' ? 'text' : 'numeric';
}
