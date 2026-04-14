// types/job.ts

export interface Job {
  id?: string;                 // Supabase id; not present in Sheets version
  row?: number;                // for old Sheet-based flows (optional)

  // Identity
  tag: string | null;
  confirmation: string | null;
  customer: string | null;
  phone: string | null;
  email: string | null;
  huntingLicenseNumber?: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  county: string | null;
  dropoff: string | null;      // ISO date string
  sex: string | null;
  processType: string | null;
  processTypeSlug?: string | null;
  processTypeRequiresCape?: boolean | null;
  processingWeightLbs?: number | null;

  // Statuses
  status: string | null;
  capingStatus: string | null;
  webbsStatus: string | null;
  specialtyStatus: string | null;

  // Cuts / packaging
  steak: string | null;
  steakOther: string | null;
  burgerSize: string | null;
  steaksPerPackage: string | null;
  beefFat: boolean;
  addOnItems?: Array<{
    slug: string;
    name: string;
    selected: boolean;
    price: number;
    sortOrder: number;
    legacyBooleanKey?: 'beefFat' | 'webbsOrder' | null;
  }>;

  hindRoastCount: string | null;
  frontRoastCount: string | null;

  hind: {
    'Hind - Steak': boolean;
    'Hind - Roast': boolean;
    'Hind - Grind': boolean;
    'Hind - None': boolean;
  };

  front: {
    'Front - Steak': boolean;
    'Front - Roast': boolean;
    'Front - Grind': boolean;
    'Front - None': boolean;
  };

  backstrapPrep: string | null;
  backstrapThickness: string | null;
  backstrapThicknessOther: string | null;

  // Specialty
  specialtyProducts: boolean;
  specialtyPounds: number;
  specialtyItems?: Array<{
    id?: string | null;
    catalogId?: string | null;
    slug: string;
    name: string;
    shortName: string;
    unit: 'lb';
    priceType: 'per_lb';
    quantity: number;
    pricePerUnit: number;
    total: number;
    sortOrder: number;
    legacyFieldKey?: string | null;
  }>;
  originalSummerSausageLbs: number;
  summerSausageCheeseLbs: number;
  jalapenoSummerSausageCheeseLbs: number;
  originalSnackSticksLbs: number;
  originalSnackSticksCheeseLbs: number;
  jalapenoSnackSticksCheeseLbs: number;

  notes: string | null;

  // Webbs
  webbsOrder: boolean;
  webbsOrderFormNumber: string | null;
  webbsPounds: number;
  webbsPaperFormCompleted?: boolean;
  webbsOrderMode?: 'needs_call' | 'online' | null;
  webbsOrderStyle?: 'itemized_lbs' | 'whole_deer_percent' | 'paper_form' | null;
  webbsItems?: Array<{
    key: string;
    label: string;
    pounds: number;
  }>;
  webbsAllocations?: Array<{
    key: string;
    label: string;
    percent: number;
  }>;

  // Pricing
  priceProcessing: number;
  priceSpecialty: number;
  price: number;
  amountPaidProcessing?: number | null;
  amountPaidSpecialty?: number | null;
  paymentMethodProcessing?: 'cash' | 'card' | 'check' | 'other' | null;
  paymentMethodSpecialty?: 'cash' | 'card' | 'check' | 'other' | null;

  // Paid flags
  paid: boolean;
  paidProcessing: boolean;
  paidSpecialty: boolean;
  requiresTag: boolean;

  // Public link / notifications
  publicToken: string | null;
  publicLinkSentAt: string | null;
  dropoffEmailSentAt: string | null;
  dropoffSmsSentAt: string | null;
  intakeSheetPrintedAt: string | null;
  intakeSheetPrintCount: number;
  updatedAt?: string | null;
  pendingDeletedAt?: string | null;
  pendingDeleteReason?: string | null;
  meatFinishedEmailSentAt: string | null;
  meatFinishedSmsSentAt: string | null;
  capeFinishedEmailSentAt: string | null;
  capeFinishedSmsSentAt: string | null;
  specialtyFinishedEmailSentAt: string | null;
  specialtyFinishedSmsSentAt: string | null;
  webbsDeliveredEmailSentAt: string | null;
  webbsDeliveredSmsSentAt: string | null;
  paidProcessingAt: string | null;
  paidSpecialtyAt: string | null;
  processingStartedAt?: string | null;
  processingFinishedAt?: string | null;

  // Pickup
  pickedUpProcessing: boolean;
  pickedUpProcessingAt: string | null;
  pickedUpCape: boolean;
  pickedUpCapeAt: string | null;
  pickedUpWebbs: boolean;
  pickedUpWebbsAt: string | null;
  pickedUpBy?: string | null;
  pickupNotes?: string | null;

  // Call tracking
  callAttempts: number;
  meatAttempts: number;
  capeAttempts: number;
  webbsAttempts: number;
  lastCallAt: string | null;
  lastCalledBy: string | null;
  lastCallOutcome: string | null;
  callNotes: string | null;

  // Comms prefs
  prefEmail: boolean;
  prefSMS: boolean;
  prefCall: boolean;
  smsConsent: boolean;
  autoCallConsent: boolean;

  // Misc
  howKilled: string | null;
}

export interface JobSearchRow {
  id?: string;
  row?: number;
  tag: string | null;
  confirmation: string | null;
  customer: string | null;
  phone: string | null;

  status: string | null;
  capingStatus: string | null;
  webbsStatus: string | null;
  specialtyStatus: string | null;

  priceProcessing: number;
  priceSpecialty: number;
  price: number;
  amountPaidProcessing?: number | null;
  amountPaidSpecialty?: number | null;
  paymentMethodProcessing?: 'cash' | 'card' | 'check' | 'other' | null;
  paymentMethodSpecialty?: 'cash' | 'card' | 'check' | 'other' | null;

  requiresTag: boolean;
  paidProcessing: boolean;
  paidSpecialty: boolean;
  paid: boolean;

  callAttempts: number;
  meatAttempts: number;
  capeAttempts: number;
  webbsAttempts: number;

  dropoff: string | null;
  intakeSheetPrintedAt?: string | null;
  intakeSheetPrintCount?: number;
  updatedAt?: string | null;
  pendingDeletedAt?: string | null;
  pickedUpBy?: string | null;
  pickupNotes?: string | null;
}
