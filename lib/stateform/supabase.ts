import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SITE } from '@/lib/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAPACITY = 43;

type SettingsRow = {
  id: number;
  stateform_page_number?: number | null;
  stateform_printed_job_ids?: string[] | null;
};

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function digitsOnly(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

function currentSeasonStart() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

function splitAddress(address: string) {
  const raw = String(address || '').trim();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const street = parts[0] || raw;
  const city = parts[1] || 'Palmyra';
  const stateZip = parts[2] || 'IN 47164';
  const zip = (stateZip.match(/\b(\d{5}(?:-\d{4})?)\b/) || [])[1] || '47164';
  return { street, city, zip };
}

function stateformKey(row: any) {
  return String(row?.id || '').trim();
}

function isPrinted(row: any, printedIds: string[]) {
  const key = stateformKey(row);
  return !!key && printedIds.includes(key);
}

function formatDateMMDDYY(v: any) {
  const s = String(v || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

function buildAddress(row: any) {
  return [row?.address, row?.city, row?.state, row?.zip].filter(Boolean).join(' ');
}

function normalizeSex(v: any) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('buck')) return 'Buck';
  if (s.includes('doe')) return 'Doe';
  if (s.includes('antler')) return 'Antlerless';
  return String(v || '').trim();
}

function normalizeHowKilled(v: any) {
  const s = String(v || '').trim().toLowerCase();
  if (s.includes('gun')) return 'Gun';
  if (s.includes('arch')) return 'Archery';
  if (s.includes('veh')) return 'Vehicle';
  return String(v || '').trim();
}

function donatedValue(row: any) {
  const proc = String(row?.process_type || '').toLowerCase();
  return proc.includes('donate') ? 'Y' : 'N';
}

export async function getStateformSettings() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('id,stateform_page_number,stateform_printed_job_ids')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return (data || { id: 1, stateform_page_number: 1, stateform_printed_job_ids: [] }) as SettingsRow;
}

export async function setStateformPageNumberInSupabase(page: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .update({ stateform_page_number: page })
    .eq('id', 1)
    .select('stateform_page_number')
    .single();

  if (error) throw error;
  return { ok: true as const, pageNumber: Number(data?.stateform_page_number || page) };
}

export async function fetchStateformPayloadFromSupabase() {
  const supabase = getSupabase();
  const settings = await getStateformSettings();
  const printedIds = Array.isArray(settings.stateform_printed_job_ids) ? settings.stateform_printed_job_ids : [];

  const { data, error } = await supabase
    .from('jobs')
    .select('id,dropoff_date,customer_name,address,city,state,zip,phone,deer_sex,county_killed,how_killed,process_type,confirmation,created_at')
    .not('confirmation', 'is', null)
    .gte('dropoff_date', currentSeasonStart())
    .order('dropoff_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw error;

  const pending = (data || []).filter((row) => !isPrinted(row, printedIds)).slice(0, CAPACITY);
  const addr = splitAddress(SITE.address);

  return {
    ok: true,
    pageYear: String(new Date().getFullYear()),
    pageNumber: Number(settings.stateform_page_number || 1),
    processorName: SITE.name,
    processorLocation: 'Palmyra, IN',
    processorCounty: process.env.NEXT_PUBLIC_COUNTY || 'Harrison',
    processorStreet: addr.street,
    processorCity: addr.city,
    processorZip: addr.zip,
    processorPhone: digitsOnly(SITE.phone).slice(-10),
    entries: pending.map((row) => ({
      jobId: row.id,
      dateIn: formatDateMMDDYY(row.dropoff_date),
      dateOut: '',
      name: String(row.customer_name || ''),
      address: buildAddress(row),
      phone: digitsOnly(row.phone).slice(-10),
      sex: normalizeSex(row.deer_sex),
      whereKilled: [row.county_killed, row.state].filter(Boolean).join(', '),
      howKilled: normalizeHowKilled(row.how_killed),
      donated: donatedValue(row),
      confirmation: digitsOnly(row.confirmation),
    })),
  };
}

export async function commitStateformPageInSupabase() {
  const supabase = getSupabase();
  const settings = await getStateformSettings();
  const payload = await fetchStateformPayloadFromSupabase();
  const currentPrinted = Array.isArray(settings.stateform_printed_job_ids) ? settings.stateform_printed_job_ids : [];
  const nextPrinted = Array.from(
    new Set([
      ...currentPrinted,
      ...payload.entries.map((entry: any) => String(entry.jobId || '')).filter(Boolean),
    ])
  );

  const nextPage = Number(settings.stateform_page_number || 1) + (payload.entries.length ? 1 : 0);

  const { error } = await supabase
    .from('site_settings')
    .update({
      stateform_page_number: nextPage,
      stateform_printed_job_ids: nextPrinted,
    })
    .eq('id', 1);

  if (error) throw error;

  return { ok: true, pageNumber: nextPage, committed: payload.entries.length };
}

export async function restageStateformJobByTag(tag: string) {
  const supabase = getSupabase();
  const settings = await getStateformSettings();
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id,tag')
    .eq('tag', tag)
    .maybeSingle();

  if (error) throw error;
  if (!job?.id) return { ok: false, error: 'Job not found' };

  const printed = Array.isArray(settings.stateform_printed_job_ids) ? settings.stateform_printed_job_ids : [];
  const nextPrinted = printed.filter((id) => id !== job.id);

  const { error: updErr } = await supabase
    .from('site_settings')
    .update({ stateform_printed_job_ids: nextPrinted })
    .eq('id', 1);

  if (updErr) throw updErr;
  return { ok: true, tag, restaged: true };
}
