export type StateFormType = 'indiana' | 'ohio' | 'michigan';

export type StateFormPageNumberSettings = {
  enabled: boolean;
  currentPage: number;
};

export type StateFormPreparedContext = {
  processorName: string;
  processorLocation: string;
  processorCounty: string;
  processorStreet: string;
  processorCity: string;
  processorZip: string;
  processorPhone: string;
  currentYear: string;
};

export type StateFormPreparedPayload = {
  ok: true;
  formType: StateFormType;
  formLabel: string;
  formDescription: string;
  reportPeriodLabel?: string;
  totalEntries: number;
  totalSheets: number;
  pageNumber: number;
  pageNumberStart: number;
  canSetPageNumber: boolean;
  entries: Record<string, any>[];
  processorName: string;
  processorLocation: string;
  processorCounty: string;
  processorStreet: string;
  processorCity: string;
  processorZip: string;
  processorPhone: string;
  pageYear: string;
};

export type StateFormDefinition = {
  type: StateFormType;
  label: string;
  description: string;
  capacity: number;
  supportsPageNumber: boolean;
  preparePayload(args: {
    rows: any[];
    pageNumberStart: number;
    context: StateFormPreparedContext;
  }): StateFormPreparedPayload;
  renderPdf(payload: StateFormPreparedPayload): Promise<Uint8Array>;
};
