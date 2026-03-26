import 'server-only';

type StaffAccessResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function parseBasicAuth(header: string | null) {
  const value = String(header || '');
  if (!value.startsWith('Basic ')) return null;

  try {
    const [user, pass] = Buffer.from(value.slice(6), 'base64').toString('utf8').split(':', 2);
    return { user, pass };
  } catch {
    return null;
  }
}

export function requireStaffAccess(req: Request): StaffAccessResult {
  const apiToken = String(process.env.DEER_API_TOKEN || '').trim();
  const basicUser = String(process.env.BASIC_AUTH_USER || '').trim();
  const basicPass = String(process.env.BASIC_AUTH_PASS || '').trim();

  const hasApiToken = !!apiToken;
  const hasBasicAuth = !!basicUser && !!basicPass;

  const headerToken = String(req.headers.get('x-api-token') || '').trim();
  if (hasApiToken && headerToken && headerToken === apiToken) {
    return { ok: true };
  }

  if (hasApiToken) {
    try {
      const url = new URL(req.url);
      const queryToken = String(url.searchParams.get('token') || '').trim();
      if (queryToken && queryToken === apiToken) {
        return { ok: true };
      }
    } catch {
      // Ignore malformed URLs and continue with other auth checks.
    }
  }

  if (hasBasicAuth) {
    const creds = parseBasicAuth(req.headers.get('authorization'));
    if (creds && creds.user === basicUser && creds.pass === basicPass) {
      return { ok: true };
    }
  }

  if (!hasApiToken && !hasBasicAuth) {
    if (process.env.NODE_ENV !== 'production') return { ok: true };
    return { ok: false, status: 500, error: 'Staff API auth is not configured.' };
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}
