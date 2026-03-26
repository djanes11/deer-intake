import { getSupabaseServer } from '@/lib/supabaseClient';

type Key = string;
const buckets = new Map<Key, { count: number; resetAt: number }>();

export function rateLimit(ip: string, key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const k = `${key}:${ip}`;
  const b = buckets.get(k);
  if (!b || b.resetAt < now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (b.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { allowed: true, remaining: limit - b.count, resetAt: b.resetAt };
}

export async function sharedRateLimit(ip: string, key: string, limit = 20, windowMs = 60_000) {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc('mcafee_rate_limit', {
      p_bucket: `${key}:${ip}`,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });

    if (!error && data) {
      return {
        allowed: !!data.allowed,
        remaining: Number(data.remaining ?? 0),
        resetAt: Number(data.resetAt ?? Date.now() + windowMs),
      };
    }
  } catch {
    // Fall back to in-memory limiter if the shared limiter is not configured yet.
  }

  return rateLimit(ip, key, limit, windowMs);
}
