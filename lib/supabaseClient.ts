// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
// If you generate types from Supabase, import them here.
// import { Database } from './supabase-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // You can log/throw here in dev to avoid silent failures
  // console.warn('Supabase env vars not configured');
}

export const supabaseServer = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);
