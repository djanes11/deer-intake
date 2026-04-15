import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { SITE } from '@/lib/config';
import { getDefaultProcessorContext, type ProcessorContext } from '@/lib/processorContext';
import { normalizeStateFormType } from '@/lib/stateforms/catalog';
import {
  currentMonthStart,
  currentSeasonStart,
  digitsOnly,
  nextMonthStart,
  splitAddress,
} from '@/lib/stateforms/shared';
import { getStateFormDefinition } from '@/lib/stateforms/registry';
import { StateFormType } from '@/lib/stateforms/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SettingsRow = {
  id: number;
  stateform_page_number?: number | null;
  state_form_type?: StateFormType | null;
};

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function getScopedProcessor(processor?: ProcessorContext | null) {
  if (processor) return processor;
  return getDefaultProcessorContext();
}

async function buildContext(processorInput?: ProcessorContext | null) {
  const supabase = getSupabase();
  const processor = await getScopedProcessor(processorInput);
  let name: string = SITE.name;
  let location: string = String((SITE as any).locationLabel || 'Palmyra, IN');
  let address: string = SITE.address;
  let phone: string = SITE.phone;

  if (processor.id) {
    const { data } = await supabase
      .from('processors')
      .select('name,public_name,public_address,location_label,support_phone_display')
      .eq('id', processor.id)
      .maybeSingle();

    if (data) {
      name = String((data as any).public_name || (data as any).name || name);
      location = String((data as any).location_label || location);
      address = String((data as any).public_address || address);
      phone = String((data as any).support_phone_display || phone);
    }
  }

  const addr = splitAddress(address);
  return {
    processorName: name,
    processorLocation: location,
    processorCounty: process.env.NEXT_PUBLIC_COUNTY || 'Harrison',
    processorStreet: addr.street,
    processorCity: addr.city,
    processorZip: addr.zip,
    processorPhone: digitsOnly(phone).slice(-10),
    currentYear: String(new Date().getFullYear()),
  };
}

export async function getStateformSettings(processorInput?: ProcessorContext | null) {
  const supabase = getSupabase();
  const processor = await getScopedProcessor(processorInput);
  let query = supabase
    .from('site_settings')
    .select('id,stateform_page_number,state_form_type');

  query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);

  const { data, error } = await query.single();

  if (error) throw error;
  return (data || { id: 1, stateform_page_number: 1, state_form_type: 'indiana' }) as SettingsRow;
}

export async function setStateformPageNumberInSupabase(page: number, processorInput?: ProcessorContext | null) {
  const processor = await getScopedProcessor(processorInput);
  const settings = await getStateformSettings(processor);
  const formType = normalizeStateFormType(settings.state_form_type);
  const definition = getStateFormDefinition(formType);
  if (!definition.supportsPageNumber) {
    return { ok: true as const, pageNumber: 1 };
  }

  const supabase = getSupabase();
  let query = supabase
    .from('site_settings')
    .update({ stateform_page_number: page });

  query = processor.id ? query.eq('processor_id', processor.id) : query.eq('id', 1);

  const { data, error } = await query
    .select('stateform_page_number')
    .single();

  if (error) throw error;
  return { ok: true as const, pageNumber: Number(data?.stateform_page_number || page) };
}

async function fetchStateformRows(stateFormType: StateFormType, processorInput?: ProcessorContext | null) {
  const supabase = getSupabase();
  const processor = await getScopedProcessor(processorInput);

  let query = supabase
    .from('jobs')
    .select('id,dropoff_date,picked_up_processing,picked_up_processing_at,updated_at,customer_name,address,city,state,zip,phone,deer_sex,county_killed,how_killed,process_type,confirmation,created_at,hunting_license_number')
    .not('confirmation', 'is', null)
    .order('dropoff_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5000);

  query = processor.id ? query.eq('processor_id', processor.id) : query;

  if (stateFormType === 'michigan') {
    query = query.gte('dropoff_date', currentMonthStart()).lt('dropoff_date', nextMonthStart());
  } else {
    query = query.gte('dropoff_date', currentSeasonStart());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchStateformPayloadFromSupabase(processorInput?: ProcessorContext | null) {
  const processor = await getScopedProcessor(processorInput);
  const settings = await getStateformSettings(processor);
  const stateFormType = normalizeStateFormType(settings.state_form_type);
  const definition = getStateFormDefinition(stateFormType);
  const rows = await fetchStateformRows(stateFormType, processor);
  const startPage = definition.supportsPageNumber
    ? Number(settings.stateform_page_number || 1)
    : 1;

  return definition.preparePayload({
    rows,
    pageNumberStart: startPage,
    context: await buildContext(processor),
  });
}
