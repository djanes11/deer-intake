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
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  county: string | null;
  dropoff: string | null;      // ISO date string
  sex: string | null;
  processType: string | null;

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
  summerSausageLbs: number;
  summerSausageCheeseLbs: number;
  slicedJerkyLbs: number;

  notes: string | null;

  // Webbs
  webbsOrder: boolean;
  webbsOrderFormNumber: string | null;
  webbsPounds: number;

  // Pricing
  priceProcessing: number;
  priceSpecialty: number;
  price: number;

  // Paid flags
  paid: boolean;
  paidProcessing: boolean;
  paidSpecialty: boolean;
  requiresTag: boolean;

  // Public link / notifications
  publicToken: string | null;
  publicLinkSentAt: string | null;
  dropoffEmailSentAt: string | null;
  paidProcessingAt: string | null;
  paidSpecialtyAt: string | null;

  // Pickup
  pickedUpProcessing: boolean;
  pickedUpProcessingAt: string | null;
  pickedUpCape: boolean;
  pickedUpCapeAt: string | null;
  pickedUpWebbs: boolean;
  pickedUpWebbsAt: string | null;

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

  requiresTag: boolean;
  paidProcessing: boolean;
  paidSpecialty: boolean;
  paid: boolean;

  callAttempts: number;
  meatAttempts: number;
  capeAttempts: number;
  webbsAttempts: number;

  dropoff: string | null;
}
