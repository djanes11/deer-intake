// lib/jobsSupabase.ts
import { getSupabaseServer } from './supabaseClient';
import { Job, JobSearchRow } from '@/types/job';

/* ---------------- helpers ---------------- */

function nowIso() {
  return new Date().toISOString();
}

function lower(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function hasAny(s: any, needles: string[]) {
  const t = lower(s);
  if (!t) return false;
  return needles.some((n) => t.includes(n));
}

function isCalled(s: any) {
  return lower(s) === 'called';
}

// Match the frontend's ready logic closely enough
function meatReady(status: any) {
  const s = lower(status);
  if (!s) return false;
  if (s === 'called') return false;
  return /finish|ready|complete|completed|done/.test(s);
}

function capeReady(capingStatus: any) {
  const s = lower(capingStatus);
  if (!s) return false;
  if (s === 'called') return false;
  return /cape|caped|ready|complete|completed|done/.test(s);
}

function webbsReady(webbsStatus: any) {
  const s = lower(webbsStatus);
  if (!s) return false;
  if (s === 'called') return false;
  return /deliver|delivered|ready|complete|completed|done/.test(s);
}

function appendStampedLine(existing: string | null | undefined, line: string) {
  const old = String(existing || '').trim();
  return old ? `${old}\n${line}` : line;
}

function stampLine(prefix: string, notes: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
  return `[${ts} • ${prefix}] ${notes}`;
}

/* ---------------- mapping ---------------- */

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

function mapDbRowToSearchRow(row: any): JobSearchRow {
  return {
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

    // If your JobSearchRow type includes these, great; if not, TS will still allow extra props at runtime
    // (and your UI is already tolerant with (r as any))
    ...(row.last_call_at ? ({ lastCallAt: row.last_call_at } as any) : {}),
    ...(row.call_notes != null ? ({ callNotes: row.call_notes } as any) : {}),
    ...(row.process_type != null ? ({ processType: row.process_type } as any) : {}),
    ...(row.beef_fat != null ? ({ beefFat: !!row.beef_fat } as any) : {}),
    ...(row.webbs_order != null ? ({ webbsOrder: !!row.webbs_order } as any) : {}),
    ...(row.specialty_products != null ? ({ specialtyProducts: !!row.specialty_products } as any) : {}),
    ...(row.summer_sausage_lbs != null ? ({ summerSausageLbs: Number(row.summer_sausage_lbs ?? 0) } as any) : {}),
    ...(row.summer_sausage_cheese_lbs != null
      ? ({ summerSausageCheeseLbs: Number(row.summer_sausage_cheese_lbs ?? 0) } as any)
      : {}),
    ...(row.sliced_jerky_lbs != null ? ({ slicedJerkyLbs: Number(row.sliced_jerky_lbs ?? 0) } as any) : {}),
    ...(row.picked_up_processing != null ? ({ pickedUpProcessing: !!row.picked_up_processing } as any) : {}),
    ...(row.picked_up_cape != null ? ({ pickedUpCape: !!row.picked_up_cape } as any) : {}),
    ...(row.picked_up_webbs != null ? ({ pickedUpWebbs: !!row.picked_up_webbs } as any) : {}),
  } as JobSearchRow;
}

/* ---------------- core reads ---------------- */

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

/* ---------------- search (now supports @report + @recall) ---------------- */

const SEARCH_SELECT = `
  id,
  tag,
  confirmation,
  customer_name,
  phone,
  status,
  caping_status,
  webbs_status,
  specialty_status,
  process_type,
  beef_fat,
  webbs_order,
  specialty_products,
  summer_sausage_lbs,
  summer_sausage_cheese_lbs,
  sliced_jerky_lbs,
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
  last_call_at,
  call_notes,
  picked_up_processing,
  picked_up_cape,
  picked_up_webbs,
  dropoff_date
`;

async function searchReport(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();

  // Pull a broad set of candidates, then filter in JS (simpler and more reliable than complex NOT-ILIKE ORs).
  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or(
      [
        'status.ilike.%finish%',
        'status.ilike.%ready%',
        'status.ilike.%complete%',
        'status.ilike.%completed%',
        'status.ilike.%done%',
        'caping_status.ilike.%cape%',
        'caping_status.ilike.%caped%',
        'caping_status.ilike.%ready%',
        'caping_status.ilike.%complete%',
        'caping_status.ilike.%completed%',
        'caping_status.ilike.%done%',
        'webbs_status.ilike.%deliver%',
        'webbs_status.ilike.%delivered%',
        'webbs_status.ilike.%ready%',
        'webbs_status.ilike.%complete%',
        'webbs_status.ilike.%completed%',
        'webbs_status.ilike.%done%',
      ].join(',')
    )
    .order('dropoff_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('searchReport error', error);
    throw error;
  }

  const filtered = (data || []).filter((r: any) => {
    const meat = meatReady(r.status);
    const cape = capeReady(r.caping_status);
    const webbs = webbsReady(r.webbs_status);
    return meat || cape || webbs;
  });

  return { ok: true, rows: filtered.map(mapDbRowToSearchRow) };
}

async function searchRecall(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();

  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or('status.eq.Called,caping_status.eq.Called,webbs_status.eq.Called')
    .order('last_call_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('searchRecall error', error);
    throw error;
  }

  // Pickup queue: called but not picked up for that track
  const filtered = (data || []).filter((r: any) => {
    const meatInQueue = isCalled(r.status) && !r.picked_up_processing;
    const capeInQueue = isCalled(r.caping_status) && !r.picked_up_cape;
    const webbsInQueue = isCalled(r.webbs_status) && !r.picked_up_webbs;
    return meatInQueue || capeInQueue || webbsInQueue;
  });

  return { ok: true, rows: filtered.map(mapDbRowToSearchRow) };
}

export async function searchJobs(query: string): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();
  const q = query.trim();

  if (!q) return { ok: true, rows: [] };

  // --- special keywords used by your UI ---
  if (q.toLowerCase() === '@report') return searchReport();
  if (q.toLowerCase() === '@recall') return searchRecall();

  // Normal search (tag/confirmation/phone/customer)
  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or(
      [
        `tag.ilike.%${q}%`,
        `confirmation.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `customer_name.ilike.%${q}%`,
      ].join(',')
    )
    .order('dropoff_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('searchJobs error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

/* ---------------- save ---------------- */

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
    updated_at: nowIso(),
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

/* ---------------- progress ---------------- */

// MAIN STATUS PROGRESSION + CAPE FLOW
export async function progressJob(tag: string) {
  const supabaseServer = getSupabaseServer();

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

  // CAPE FLOW (buck + caped): Dropped Off -> Caping -> Caped
  const deerSex = String(job.deer_sex || '').trim().toLowerCase();
  const procType = String(job.process_type || '').trim().toLowerCase();
  const isBuck = deerSex.includes('buck');
  const isCaped = procType.includes('cape');

  const curCapingRaw = String(job.caping_status || '').trim();
  const curCaping = curCapingRaw.toLowerCase();

  let nextCaping: string | null = null;

  if (isBuck && isCaped) {
    if (isInitialStatus) {
      nextCaping = 'Caping';
    } else if (curCaping === 'caping') {
      nextCaping = 'Caped';
    }
  }

  const updates: any = {};
  if (nextStatus) updates.status = nextStatus;
  if (nextCaping) updates.caping_status = nextCaping;

  if (Object.keys(updates).length === 0) {
    return { ok: true, nextStatus: null, job: null };
  }

  updates.updated_at = nowIso();

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

/* ---------------- calling / logs ---------------- */

// LOG CALL + ATTEMPTS (used by "+1 Attempt" and optional notes)
export async function logCall(params: {
  tag: string;
  scope?: 'meat' | 'cape' | 'webbs';
  reason?: string;
  notes?: string;
  outcome?: string;
  who?: string; // optional; safe if you later add a column or ignore it
}) {
  const supabaseServer = getSupabaseServer();
  const { tag, scope, reason, notes, outcome } = params;

  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) return { ok: false, error: 'Job not found for tag ' + tag };

  // Write call log (best-effort)
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

  // Update counters + last call metadata
  const patch: any = {
    call_attempts: (job.call_attempts ?? 0) + 1,
    last_call_at: nowIso(),
    last_call_outcome: outcome ?? job.last_call_outcome ?? null,
    updated_at: nowIso(),
  };

  if (scope === 'meat') patch.meat_attempts = (job.meat_attempts ?? 0) + 1;
  if (scope === 'cape') patch.cape_attempts = (job.cape_attempts ?? 0) + 1;
  if (scope === 'webbs') patch.webbs_attempts = (job.webbs_attempts ?? 0) + 1;

  // Append notes rather than overwrite
  const noteText = String(notes || '').trim();
  if (noteText) {
    const line = stampLine(reason || `Call Attempt (${scope || 'auto'})`, noteText);
    patch.call_notes = appendStampedLine(job.call_notes, line);
  }

  const { error: updateError } = await supabaseServer
    .from('jobs')
    .update(patch)
    .eq('id', job.id);

  if (updateError) throw updateError;

  return { ok: true };
}

// MARK CALLED (used by "Mark Called" button)
export async function markCalled(params: {
  tag: string;
  scope?: 'meat' | 'cape' | 'webbs' | 'all' | 'auto';
  notes?: string;
}) {
  const supabaseServer = getSupabaseServer();
  const { tag, scope: rawScope, notes } = params;

  const { data: job, error: jobError } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('tag', tag)
    .maybeSingle();

  if (jobError) {
    console.error('markCalled get error', jobError);
    throw jobError;
  }
  if (!job) return { ok: false, error: 'Job not found for tag ' + tag };

  const sNow = job.status;
  const cNow = job.caping_status;
  const wNow = job.webbs_status;

  const meatIsReady = meatReady(sNow);
  const capeIsReady = capeReady(cNow);
  const webbsIsReady = webbsReady(wNow);

  let scope = (rawScope || 'auto') as 'meat' | 'cape' | 'webbs' | 'all' | 'auto';
  const updates: any = {};
  const callStamp = nowIso();

  if (scope === 'all') {
    if (meatIsReady) updates.status = 'Called';
    if (capeIsReady) updates.caping_status = 'Called';
    if (webbsIsReady) updates.webbs_status = 'Called';
  } else if (scope === 'meat') {
    updates.status = 'Called';
  } else if (scope === 'cape') {
    updates.caping_status = 'Called';
  } else if (scope === 'webbs') {
    updates.webbs_status = 'Called';
  } else {
    // auto: choose a sensible default (prefer the ones that actually are ready)
    if (webbsIsReady) {
      updates.webbs_status = 'Called';
      scope = 'webbs';
    } else if (capeIsReady) {
      updates.caping_status = 'Called';
      scope = 'cape';
    } else {
      updates.status = 'Called';
      scope = 'meat';
    }
  }

  // Also bump attempts + last_call_at so UI updates immediately
  updates.last_call_at = callStamp;
  updates.call_attempts = (job.call_attempts ?? 0) + 1;
  if (scope === 'meat') updates.meat_attempts = (job.meat_attempts ?? 0) + 1;
  if (scope === 'cape') updates.cape_attempts = (job.cape_attempts ?? 0) + 1;
  if (scope === 'webbs') updates.webbs_attempts = (job.webbs_attempts ?? 0) + 1;

  // Append call notes if provided
  const noteText = String(notes || '').trim();
  if (noteText) {
    const line = stampLine(`Marked Called (${scope})`, noteText);
    updates.call_notes = appendStampedLine(job.call_notes, line);
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = nowIso();

    const { error: updErr } = await supabaseServer
      .from('jobs')
      .update(updates)
      .eq('id', job.id);

    if (updErr) {
      console.error('markCalled update error', updErr);
      throw updErr;
    }
  }

  // Write call log (best-effort)
  try {
    await supabaseServer.from('call_logs').insert({
      job_id: job.id,
      tag,
      customer_name: job.customer_name,
      phone: job.phone,
      scope,
      reason: `Marked Called (${scope})`,
      outcome: null,
      notes: noteText || null,
    });
  } catch (e) {
    console.error('markCalled log error', e);
  }

  return { ok: true, tag, scope };
}

/* ---------------- needsTag ---------------- */

export async function listJobsNeedingTag(): Promise<{ ok: boolean; rows: JobSearchRow[] }> {
  const supabaseServer = getSupabaseServer();

  const { data, error } = await supabaseServer
    .from('jobs')
    .select(SEARCH_SELECT)
    .or('tag.is.null,tag.eq.,requires_tag.eq.true')
    .order('dropoff_date', { ascending: false })
    .limit(200);

  if (error) {
    console.error('listJobsNeedingTag error', error);
    throw error;
  }

  return { ok: true, rows: (data || []).map(mapDbRowToSearchRow) };
}

/* ---------------- setTag ---------------- */

export async function setJobTag(params: {
  jobId: string;
  newTag: string;
  stampDropEmail?: boolean;
  returnRow?: boolean;
}) {
  const supabaseServer = getSupabaseServer();
  const { jobId, newTag, stampDropEmail, returnRow } = params;

  const tag = String(newTag || '').trim();
  if (!jobId || !tag) {
    return { ok: false, error: 'Missing jobId or newTag' };
  }

  // Ensure tag not already used by another job
  const { data: existing, error: existErr } = await supabaseServer
    .from('jobs')
    .select('id, tag')
    .eq('tag', tag)
    .neq('id', jobId)
    .maybeSingle();

  if (existErr) {
    console.error('setJobTag check error', existErr);
    throw existErr;
  }
  if (existing) {
    return { ok: false, error: 'Tag already in use' };
  }

  // Load current job
  const { data: job, error: jobErr } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr) {
    console.error('setJobTag get error', jobErr);
    throw jobErr;
  }
  if (!job) {
    return { ok: false, error: 'Job not found' };
  }

  const updates: any = {
    tag,
    requires_tag: false,
    updated_at: nowIso(),
  };

  let stamped = false;
  if (stampDropEmail) {
    updates.dropoff_email_sent_at = nowIso();
    stamped = true;
  }

  const { data: updated, error: updErr } = await supabaseServer
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .maybeSingle();

  if (updErr) {
    console.error('setJobTag update error', updErr);
    throw updErr;
  }

  if (!returnRow) {
    return { ok: true, jobId, tag };
  }

  const mapped = updated ? mapDbRowToJob(updated) : null;
  return {
    ok: true,
    jobId,
    tag,
    job: mapped,
    dropEmailStamped: stamped,
  };
}
