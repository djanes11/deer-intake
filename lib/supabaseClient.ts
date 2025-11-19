// lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient<any> | null = null;

export function getSupabaseServer(): SupabaseClient<any> {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase env not configured');
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
}
