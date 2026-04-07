import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getStaffIdentity, getStaffProcessorContext } from '@/lib/staffContext';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type AuditEntryInput = {
  req?: Request | null;
  processorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  summary: string;
  details?: Record<string, unknown>;
};

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function writeAuditEntry(input: AuditEntryInput) {
  const supabase = getSupabase();
  const identity = await getStaffIdentity(input.req);
  const processorContext = input.processorId ? null : await getStaffProcessorContext(input.req);
  const processorId = String(input.processorId || processorContext?.id || '').trim();
  if (!processorId) return;

  const actorRole =
    processorContext?.id === processorId
      ? processorContext.role
      : identity.authType === 'local'
        ? (identity.role || null)
        : null;

  const payload = {
    processor_id: processorId,
    actor_auth_type: identity.authType,
    actor_user_id: identity.userId || null,
    actor_email: identity.email || null,
    actor_username: identity.username || null,
    actor_role: actorRole || null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId || null,
    target_label: input.targetLabel || null,
    summary: input.summary,
    details: input.details || {},
  };

  const { error } = await supabase.from('processor_audit_log').insert(payload);
  if (error) throw error;
}
