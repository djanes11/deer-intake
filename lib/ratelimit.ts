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
