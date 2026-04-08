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
  const [processors, setProcessors] = useState<Array<{ slug: string; name: string }>>([]);
  const [processorListError, setProcessorListError] = useState(false);
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

  useEffect(() => {
    const loadProcessors = async () => {
      try {
        const res = await fetch('/api/staff/processors', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error('Unable to load processors.');
        const rows = Array.isArray(json?.processors) ? json.processors : [];
        setProcessors(rows);
        if (!processorSlug && rows[0]?.slug) {
          setProcessorSlug(String(rows[0].slug));
        }
      } catch {
        setProcessorListError(true);
      }
    };
    void loadProcessors();
  }, []);

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
    <main style={{ maxWidth: 1080, margin: '34px auto', padding: '0 16px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(360px, 460px)',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        <section
          style={{
            borderRadius: 24,
            padding: 28,
            border: '1px solid rgba(200,138,61,.18)',
            background:
              'radial-gradient(circle at top right, rgba(200,138,61,.16) 0%, transparent 30%), linear-gradient(180deg, rgba(21,20,19,.96) 0%, rgba(13,12,11,.98) 100%)',
            color: '#f5ecd8',
            display: 'grid',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/wgbb-logo.png"
              alt="Wild Game Butcher Board"
              style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 18, boxShadow: '0 10px 24px rgba(0,0,0,.28)' }}
            />
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d1b07a' }}>
                Staff Portal
              </div>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: '#fff7e8' }}>Wild Game Butcher Board</h1>
              <div style={{ color: 'rgba(245,236,216,.78)', fontSize: 15 }}>
                Deer processing operations, intake, and pickup workflow in one place.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              {
                title: 'Processor Admin Login',
                body: 'Best for owners and managers who need email recovery, public site settings, staff management, and business reporting.',
              },
              {
                title: 'Staff Login',
                body: 'Best for front counter and production-floor staff using a simple processor, username, and password login created by the processor admin.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.08)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 17, color: '#fff7e8' }}>{item.title}</div>
                <div style={{ lineHeight: 1.5, color: 'rgba(245,236,216,.78)' }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="card"
          style={{
            padding: 22,
            display: 'grid',
            gap: 16,
            borderRadius: 24,
            border: '1px solid rgba(200,138,61,.18)',
            background: 'rgba(255,255,255,.97)',
            boxShadow: '0 18px 44px rgba(15,23,42,.14)',
          }}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a5a20' }}>
              Secure Sign In
            </div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>{mode === 'admin' ? 'Processor Admin Login' : 'Staff Login'}</div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {mode === 'admin'
                ? 'Use your staff email and password to manage the processor, settings, reports, and team access.'
                : 'Choose your processor, then enter the local username and password your processor admin created for you.'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              padding: 6,
              borderRadius: 16,
              background: '#f6efe3',
              border: '1px solid #ead9bf',
            }}
          >
            <button
              type="button"
              onClick={() => setMode('admin')}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: mode === 'admin' ? '1px solid #c88a3d' : '1px solid transparent',
                background: mode === 'admin' ? '#fffaf2' : 'transparent',
                color: mode === 'admin' ? '#111827' : '#6b7280',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: mode === 'admin' ? '0 6px 18px rgba(200,138,61,.12)' : 'none',
              }}
            >
              Processor Admin
            </button>
            <button
              type="button"
              onClick={() => setMode('staff')}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: mode === 'staff' ? '1px solid #c88a3d' : '1px solid transparent',
                background: mode === 'staff' ? '#fffaf2' : 'transparent',
                color: mode === 'staff' ? '#111827' : '#6b7280',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: mode === 'staff' ? '0 6px 18px rgba(200,138,61,.12)' : 'none',
              }}
            >
              Staff Login
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          {mode === 'admin' ? (
            <>
              <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                Processor admins use email and password so they can recover their own access and manage the rest of the team.
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Staff email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@processor.com"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                Local staff logins are created by a processor admin. Choose your processor, then use the username and password they gave you.
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Processor</label>
                {processors.length ? (
                  <select
                    value={processorSlug}
                    onChange={(e) => setProcessorSlug(e.target.value)}
                    required
                    style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                  >
                    {processors.map((processor) => (
                      <option key={processor.slug} value={processor.slug}>
                        {processor.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    autoComplete="organization"
                    value={processorSlug}
                    onChange={(e) => setProcessorSlug(e.target.value)}
                    placeholder="processor code"
                    required
                    style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                  />
                )}
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                  {processors.length
                    ? 'If you work for more than one processor, pick the one you are signing into right now.'
                    : processorListError
                      ? 'Processor list unavailable right now. Enter the processor code your admin gave you.'
                      : 'Loading processor list...'}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
              </div>
            </>
          )}
          {error ? (
            <div style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
              {error}
            </div>
          ) : null}
          <button
            className="btn"
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 16px',
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            {busy ? 'Signing In...' : 'Sign In'}
          </button>
          {mode === 'admin' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
              <Link href={`/staff/forgot-password?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                Forgot password?
              </Link>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
              If you forget a local staff password, ask a processor admin to reset it from <strong>Staff Team</strong>.
            </div>
          )}
          </form>
        </section>
      </div>
    </main>
  );
}
