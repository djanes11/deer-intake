'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { clearLocalStaffSessionCookie, clearStaffAccessCookie, setLocalStaffSessionCookie, STAFF_ACCESS_COOKIE, STAFF_LOCAL_SESSION_COOKIE, setStaffAccessCookie } from '@/lib/staffSession';

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const [mode, setMode] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState('');
  const [processorSlug, setProcessorSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hasStaffCookie = document.cookie
      .split(';')
      .some((part) =>
        part.trim().startsWith(`${STAFF_ACCESS_COOKIE}=`) ||
        part.trim().startsWith(`${STAFF_LOCAL_SESSION_COOKIE}=`)
      );
    if (!hasStaffCookie) return;

    let cancelled = false;
    const validate = async () => {
      try {
        const resp = await fetch('/api/admin/staff-context', { cache: 'no-store' });
        const json = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (json?.ok && (json?.identity?.authType === 'supabase' || json?.identity?.authType === 'local')) {
          router.replace(next);
          router.refresh();
          return;
        }
      } catch {
        // Fall through and clear the stale cookie.
      }

      if (!cancelled) {
        clearStaffAccessCookie();
        clearLocalStaffSessionCookie();
      }
    };

    void validate();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      clearStaffAccessCookie();
      clearLocalStaffSessionCookie();
      if (mode === 'admin') {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('No session returned from Supabase.');
        setStaffAccessCookie(accessToken);
      } else {
        const res = await fetch('/api/staff/local-login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            processorSlug,
            username,
            password,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok || !json?.sessionToken) throw new Error(json?.error || `HTTP ${res.status}`);
        setLocalStaffSessionCookie(String(json.sessionToken));
      }
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 460, margin: '48px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
            Wild Game Butcher Board
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30 }}>Staff Login</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Sign in with your staff account to access the shared staff site.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ opacity: mode === 'admin' ? 1 : 0.72 }} onClick={() => setMode('admin')}>
            Processor Admin
          </button>
          <button type="button" className="btn secondary" style={{ opacity: mode === 'staff' ? 1 : 0.82 }} onClick={() => setMode('staff')}>
            Staff Login
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          {mode === 'admin' ? (
            <>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label>Processor</label>
                <input
                  type="text"
                  autoComplete="organization"
                  value={processorSlug}
                  onChange={(e) => setProcessorSlug(e.target.value)}
                  placeholder="mcafee"
                  required
                />
              </div>
              <div>
                <label>Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Signing In...' : 'Sign In'}
          </button>
          {mode === 'admin' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
              <Link href={`/staff/forgot-password?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                Forgot password?
              </Link>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 14 }}>
              If a staff member forgets their password, a processor admin can reset it from Staff Team.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
