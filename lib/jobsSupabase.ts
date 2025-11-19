// lib/jobsSupabase.ts
import { getSupabaseServer } from './supabaseClient';
import { Job, JobSearchRow } from '@/types/job';

// Map DB row → Job (what your frontend expects)
function mapDbRowToJob(row: any): Job {
  return {
    id: row.id,
    row: undefined, // only used for Sheets, not Supabase

    // Identity
    tag: row.tag,
    confirmation: row.confirmation,
    customer: row.customer_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,

    county: row.county_killed,
    dropoff: row.dropoff_date,
    sex: row.deer_sex,
    processType: row.process_type,

    // Statuses
    status: row.status,
    capingStatus: row.caping_status,
    webbsStatus: row.webbs_status,
    specialtyStatus: row.specialty_status,

    // Cuts / packaging
    steak: row.steak_size,
    steakOther: row.steak_size_other,
    burgerSize: row.burger_size,
    steaksPerPackage: row.steaks_per_package,
    beefFat: !!row.beef_fat,

    hindRoastCount: row.hind_roast_count != null ? String(row.hind_roast_count) : null,
    frontRoastCount: row.front_roast_count != null ? String(row.front_roast_count) : null,

    hind: {
      'Hind - Steak': !!row.hind_steak,
      'Hind - Roast': !!row.hind_roast,
      'Hind - Grind': !!row.hind_grind,
      'Hind - None': !!row.hind_none,
    },
    front: {
      'Front - Steak': !!row.front_steak,
      'Front - Roast': !!row.front_roast,
      'Front - Grind': !!row.front_grind,
      'Front - None': !!row.front_none,
    },

    backstrapPrep: row.backstrap_prep,
    backstrapThickness: row.backstrap_thickness,
    backstrapThicknessOther: row.backstrap_thickness_other,

    // Specialty
    specialtyProducts: !!row.specialty_products,
    specialtyPounds: Number(row.specialty_pounds ?? 0),
    summerSausageLbs: Number(row.summer_sausage_lbs ?? 0),
    summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0),
    slicedJerkyLbs: Number(row.sliced_jerky_lbs ?? 0),

    notes: row.notes,

    // Webbs
    webbsOrder: !!row.webbs_order,
    webbsOrderFormNumber: row.webbs_order_form_number,
    webbsPounds: Number(row.webbs_pounds ?? 0),

    // Pricing
    priceProcessing: Number(row.price_processing ?? 0),
    priceSpecialty: Number(row.price_specialty ?? 0),
    price: Number(row.price_total ?? 0),

    // Paid flags
    paid: !!row.paid,
    paidProcessing: !!row.paid_processing,
    paidSpecialty: !!row.paid_specialty,
    requiresTag: !!row.requires_tag,

    // Public link / notifications
    publicToken: row.public_token,
    publicLinkSentAt: row.public_link_sent_at,
    dropoffEmailSentAt: row.dropoff_email_sent_at,
    paidProcessingAt: row.paid_processing_at,
    paidSpecialtyAt: row.paid_specialty_at,

    // Pickup
    pickedUpProcessing: !!row.picked_up_processing,
    pickedUpProcessingAt: row.picked_up_processing_at,
    pickedUpCape: !!row.picked_up_cape,
    pickedUpCapeAt: row.picked_up_cape_at,
    pickedUpWebbs: !!row.picked_up_webbs,
    pickedUpWebbsAt: row.picked_up_webbs_at,

    // Call tracking
    callAttempts: Number(row.call_attempts ?? 0),
    meatAttempts: Number(row.meat_attempts ?? 0),
    capeAttempts: Number(row.cape_attempts ?? 0),
    webbsAttempts: Number(row.webbs_attempts ?? 0),
    lastCallAt: row.last_call_at,
    lastCalledBy: row.last_called_by,
    lastCallOutcome: row.last_call_outcome,
    callNotes: row.call_notes,

    // Comms prefs
    prefEmail: !!row.pref_email,
    prefSMS: !!row.pref_sms,
    prefCall: !!row.pref_call,
    smsConsent: !!row.sms_consent,
    autoCallConsent: !!row.auto_call_consent,

    // Misc
    howKilled: row.how_killed,
  };
}

export async function getJobByTag(tag: string) {
  const supabaseServer = getSupabaseServer();

  const { data, error } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (error) {
    console.error('getJobByTag error', error);
    throw error;
  }

  if (!data) {
    return { ok: true, exists: false as const, job: null as Job | null };
  }

  return { ok: true, exists: true as const, job: mapDbRowToJob(data) };
}

export async function searchJobs(query: string): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const q = query.trim();
  if (!q) return { ok: true, rows: [] };

  const { data, error } = await supabaseServer
    .from('jobs')
    .select(
      `
      id,
      tag,
      confirmation,
      customer_name,
      phone,
      status,
      caping_status,
      webbs_status,
      specialty_status,
      price_processing,
      price_specialty,
      price_total,
      requires_tag,
      paid_processing,
      paid_specialty,
      paid,
      call_attempts,
      meat_attempts,
      cape_attempts,
      webbs_attempts,
      dropoff_date
    `
    )
    .or(
      [
        `tag.ilike.%${q}%`,
        `confirmation.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
      ].join(',')
    )
    .limit(50);

  if (error) {
    console.error('searchJobs error', error);
    throw error;
  }

  const rows: JobSearchRow[] =
    data?.map((row: any) => ({
      tag: row.tag,
      confirmation: row.confirmation,
      customer: row.customer_name,
      phone: row.phone,
      status: row.status,
      capingStatus: row.caping_status,
      webbsStatus: row.webbs_status,
      specialtyStatus: row.specialty_status,
      priceProcessing: Number(row.price_processing ?? 0),
      priceSpecialty: Number(row.price_specialty ?? 0),
      price: Number(row.price_total ?? 0),
      requiresTag: !!row.requires_tag,
      paidProcessing: !!row.paid_processing,
      paidSpecialty: !!row.paid_specialty,
      paid: !!row.paid,
      callAttempts: Number(row.call_attempts ?? 0),
      meatAttempts: Number(row.meat_attempts ?? 0),
      capeAttempts: Number(row.cape_attempts ?? 0),
      webbsAttempts: Number(row.webbs_attempts ?? 0),
      dropoff: row.dropoff_date,
    })) ?? [];

  return { ok: true, rows };
}

export async function saveJob(job: Partial<Job>) {
  const supabaseServer = getSupabaseServer();

  const upsertPayload: any = {
    tag: job.tag ?? null,
    confirmation: job.confirmation ?? null,
    customer_name: job.customer ?? null,
    phone: job.phone ?? null,
    email: job.email ?? null,
    address: job.address ?? null,
    city: job.city ?? null,
    state: job.state ?? null,
    zip: job.zip ?? null,

    county_killed: job.county ?? null,
    deer_sex: job.sex ?? null,
    process_type: job.processType ?? null,
    dropoff_date: job.dropoff ?? null,

    status: job.status ?? null,
    caping_status: job.capingStatus ?? null,
    webbs_status: job.webbsStatus ?? null,
    specialty_status: job.specialtyStatus ?? null,

    steak_size: job.steak ?? null,
    steak_size_other: job.steakOther ?? null,
    burger_size: job.burgerSize ?? null,
    steaks_per_package: job.steaksPerPackage ?? null,
    beef_fat: job.beefFat ?? false,

    hind_roast_count: job.hindRoastCount ? Number(job.hindRoastCount) : null,
    front_roast_count: job.frontRoastCount ? Number(job.frontRoastCount) : null,

    hind_steak: job.hind?.['Hind - Steak'] ?? false,
    hind_roast: job.hind?.['Hind - Roast'] ?? false,
    hind_grind: job.hind?.['Hind - Grind'] ?? false,
    hind_none: job.hind?.['Hind - None'] ?? false,

    front_steak: job.front?.['Front - Steak'] ?? false,
    front_roast: job.front?.['Front - Roast'] ?? false,
    front_grind: job.front?.['Front - Grind'] ?? false,
    front_none: job.front?.['Front - None'] ?? false,

    backstrap_prep: job.backstrapPrep ?? null,
    backstrap_thickness: job.backstrapThickness ?? null,
    backstrap_thickness_other: job.backstrapThicknessOther ?? null,

    specialty_products: job.specialtyProducts ?? false,
    specialty_pounds: job.specialtyPounds ?? 0,
    summer_sausage_lbs: job.summerSausageLbs ?? 0,
    summer_sausage_cheese_lbs: job.summerSausageCheeseLbs ?? 0,
    sliced_jerky_lbs: job.slicedJerkyLbs ?? 0,

    notes: job.notes ?? null,

    webbs_order: job.webbsOrder ?? false,
    webbs_order_form_number: job.webbsOrderFormNumber ?? null,
    webbs_pounds: job.webbsPounds ?? 0,

    price_processing: job.priceProcessing ?? 0,
    price_specialty: job.priceSpecialty ?? 0,
    price_total: job.price ?? 0,

    paid: job.paid ?? false,
    paid_processing: job.paidProcessing ?? false,
    paid_specialty: job.paidSpecialty ?? false,
    requires_tag: job.requiresTag ?? false,

    public_token: job.publicToken ?? null,
    public_link_sent_at: job.publicLinkSentAt ?? null,
    dropoff_email_sent_at: job.dropoffEmailSentAt ?? null,
    paid_processing_at: job.paidProcessingAt ?? null,
    paid_specialty_at: job.paidSpecialtyAt ?? null,

    picked_up_processing: job.pickedUpProcessing ?? false,
    picked_up_processing_at: job.pickedUpProcessingAt ?? null,
    picked_up_cape: job.pickedUpCape ?? false,
    picked_up_cape_at: job.pickedUpCapeAt ?? null,
    picked_up_webbs: job.pickedUpWebbs ?? false,
    picked_up_webbs_at: job.pickedUpWebbsAt ?? null,

    call_attempts: job.callAttempts ?? 0,
    meat_attempts: job.meatAttempts ?? 0,
    cape_attempts: job.capeAttempts ?? 0,
    webbs_attempts: job.webbsAttempts ?? 0,
    last_call_at: job.lastCallAt ?? null,
    last_called_by: job.lastCalledBy ?? null,
    last_call_outcome: job.lastCallOutcome ?? null,
    call_notes: job.callNotes ?? null,

    pref_email: job.prefEmail ?? false,
    pref_sms: job.prefSMS ?? false,
    pref_call: job.prefCall ?? false,
    sms_consent: job.smsConsent ?? false,
    auto_call_consent: job.autoCallConsent ?? false,

    how_killed: job.howKilled ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from('jobs')
    .upsert(upsertPayload, {
      onConflict: 'tag',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('saveJob error', error);
    throw error;
  }

  return { ok: true, job: data ? mapDbRowToJob(data) : null };
}

export async function progressJob(tag: string) {
  const supabaseServer = getSupabaseServer();

  // Find job by tag
  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) {
    console.error('progressJob get error', jobError);
    throw jobError;
  }

  if (!job) {
    // Nothing to update if tag not found
    return { ok: true, nextStatus: null, job: null };
  }

  const curStatusRaw = String(job.status || '').trim();
  const curStatus = curStatusRaw.toLowerCase();

  const isInitialStatus =
    !curStatus ||
    curStatus === 'dropped off' ||
    curStatus === 'drop off' ||
    curStatus === 'droppedoff';

  let nextStatus: string | null = null;

  // MAIN STATUS FLOW:
  // initial/ dropped off -> Skinning -> Skinned -> Processing -> Finished
  if (isInitialStatus) {
    nextStatus = 'Skinning';
  } else if (curStatus === 'skinning') {
    nextStatus = 'Skinned';
  } else if (curStatus === 'skinned') {
    nextStatus = 'Processing';
  } else if (curStatus === 'processing') {
    nextStatus = 'Finished';
  } else {
    nextStatus = null;
  }

  // CAPE FLOW (only for buck + caped jobs)
  const deerSex = String(job.deer_sex || '').trim().toLowerCase();
  const procType = String(job.process_type || '').trim().toLowerCase();
  const isBuck = deerSex.includes('buck');
  const isCaped = procType.includes('cape'); // "Caped", "Caping", "Cape & Donate", etc.

  const curCapingRaw = String(job.caping_status || '').trim();
  const curCaping = curCapingRaw.toLowerCase();

  let nextCaping: string | null = null;

  if (isBuck && isCaped) {
    // First scan: main initial → Skinning, cape → Caping
    if (isInitialStatus) {
      nextCaping = 'Caping';
    }
    // Second scan: main Skinning → Skinned, cape Caping → Caped
    else if (curCaping === 'caping') {
      nextCaping = 'Caped';
    }
    // Otherwise, leave cape status alone
  }

  const updates: any = {};

  if (nextStatus) {
    updates.status = nextStatus;
  }
  if (nextCaping) {
    updates.caping_status = nextCaping;
  }

  if (Object.keys(updates).length === 0) {
    // Nothing to change
    return { ok: true, nextStatus: null, job: null };
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updErr } = await supabaseServer
    .from('jobs')
    .update(updates)
    .eq('id', job.id)
    .select('*')
    .maybeSingle();

  if (updErr) {
    console.error('progressJob update error', updErr);
    throw updErr;
  }

  return {
    ok: true,
    nextStatus,
    job: updated ? mapDbRowToJob(updated) : null,
  };
}


export async function logCall(params: {
  tag: string;
  scope?: 'meat' | 'cape' | 'webbs';
  reason?: string;
  notes?: string;
  outcome?: string;
}) {
  const supabaseServer = getSupabaseServer();
  const { tag, scope, reason, notes, outcome } = params;

  // Find job by tag
  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) {
    return { ok: false, error: 'Job not found for tag ' + tag };
  }

  // Insert into call_logs
  const { error: logError } = await supabaseServer.from('call_logs').insert({
    job_id: job.id,
    tag,
    customer_name: job.customer_name,
    phone: job.phone,
    scope: scope ?? null,
    reason: reason ?? null,
    outcome: outcome ?? null,
    notes: notes ?? null,
  });

  if (logError) throw logError;

  // Update attempts counters on jobs
  const patch: any = {
    call_attempts: (job.call_attempts ?? 0) + 1,
    last_call_at: new Date().toISOString(),
    last_call_outcome: outcome ?? null,
    call_notes: notes ?? job.call_notes ?? null,
  };

  if (scope === 'meat') patch.meat_attempts = (job.meat_attempts ?? 0) + 1;
  if (scope === 'cape') patch.cape_attempts = (job.cape_attempts ?? 0) + 1;
  if (scope === 'webbs') patch.webbs_attempts = (job.webbs_attempts ?? 0) + 1;

  const { error: updateError } = await supabaseServer
    .from('jobs')
    .update(patch)
    .eq('id', job.id);

  if (updateError) throw updateError;

  return { ok: true };
}
