import 'server-only';

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type LocalStaffSession = {
  localUserId: string;
  processorId: string;
  processorSlug: string;
  username: string;
  role: 'staff' | 'readonly';
  active: boolean;
  expiresAt: string;
};

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function normalizeUsername(raw: unknown) {
  return String(raw || '').trim().toLowerCase();
}

export function hashLocalPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyLocalPassword(password: string, storedHash: string) {
  const [algo, salt, digest] = String(storedHash || '').split(':');
  if (algo !== 'scrypt' || !salt || !digest) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function createLocalStaffSession(input: { username: string; password: string }) {
  const supabase = getSupabase();
  const username = normalizeUsername(input.username);
  const password = String(input.password || '').trim();
  if (!username || !password) throw new Error('Username and password are required.');

  const userResp = await supabase
    .from('staff_local_users')
    .select('id,processor_id,username,password_hash,role,active,processors!inner(id,slug,active)')
    .ilike('username', username)
    .maybeSingle();
  if (userResp.error) throw userResp.error;
  const localUser: any = userResp.data;
  const processor = Array.isArray(localUser?.processors) ? localUser.processors[0] : localUser?.processors;
  if (!localUser?.id || !localUser.active) throw new Error('Invalid username or password.');
  if (!processor?.id || processor?.active === false) throw new Error('This staff login is not active right now.');
  if (!verifyLocalPassword(password, String(localUser.password_hash || ''))) throw new Error('Invalid username or password.');

  const sessionToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const insertResp = await supabase
    .from('staff_local_sessions')
    .insert({
      local_user_id: localUser.id,
      session_token: sessionToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select('local_user_id,expires_at')
    .single();
  if (insertResp.error) throw insertResp.error;

  return {
    sessionToken,
    session: {
      localUserId: String(localUser.id),
      processorId: String(localUser.processor_id),
      processorSlug: String(processor.slug),
      username: String(localUser.username),
      role: String(localUser.role) as 'staff' | 'readonly',
      active: !!localUser.active,
      expiresAt,
    } satisfies LocalStaffSession,
  };
}

export async function getLocalStaffSessionByToken(token: string): Promise<LocalStaffSession | null> {
  const sessionToken = String(token || '').trim();
  if (!sessionToken) return null;
  const supabase = getSupabase();
  const resp = await supabase
    .from('staff_local_sessions')
    .select('expires_at,staff_local_users!inner(id,processor_id,username,role,active,processors!inner(slug))')
    .eq('session_token', sessionToken)
    .maybeSingle();
  if (resp.error) throw resp.error;
  const row: any = resp.data;
  const localUser = Array.isArray(row?.staff_local_users) ? row.staff_local_users[0] : row?.staff_local_users;
  const processor = Array.isArray(localUser?.processors) ? localUser.processors[0] : localUser?.processors;
  if (!row?.expires_at || !localUser?.id || !processor?.slug || !localUser?.active) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  return {
    localUserId: String(localUser.id),
    processorId: String(localUser.processor_id),
    processorSlug: String(processor.slug),
    username: String(localUser.username),
    role: String(localUser.role) as 'staff' | 'readonly',
    active: !!localUser.active,
    expiresAt: String(row.expires_at),
  };
}

export async function clearLocalStaffSession(token: string) {
  const sessionToken = String(token || '').trim();
  if (!sessionToken) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('staff_local_sessions').delete().eq('session_token', sessionToken);
  if (error) throw error;
}
