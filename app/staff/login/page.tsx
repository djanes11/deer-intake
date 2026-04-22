'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

const ADMIN_HOSTNAME = (process.env.NEXT_PUBLIC_ADMIN_HOSTNAME || 'admin.wildgamebutcherboard.com').trim().toLowerCase();

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const [mode, setMode] = useState<'admin' | 'staff'>('admin');
  const [isAdminHost, setIsAdminHost] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.host.trim().toLowerCase().split(':')[0] || '';
    setIsAdminHost(host === ADMIN_HOSTNAME);
    if (host === ADMIN_HOSTNAME) setMode('admin');
  }, []);

  useEffect(() => {
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
        await fetch('/api/staff/session', { method: 'DELETE', cache: 'no-store' }).catch(() => {});
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
    setRedirecting(false);
    setError('');
    try {
      await fetch('/api/staff/session', { method: 'DELETE', cache: 'no-store' }).catch(() => {});
      if (mode === 'admin') {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('No session returned from Supabase.');
        const sessionRes = await fetch('/api/staff/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ accessToken }),
        });
        const sessionJson = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok || !sessionJson?.ok) throw new Error(sessionJson?.error || `HTTP ${sessionRes.status}`);
        if (data.user?.app_metadata?.wgbb_force_password_change) {
          setRedirecting(true);
          router.replace(`/staff/account?next=${encodeURIComponent(next)}&force=1`);
          router.refresh();
          return;
        }
      } else {
        const res = await fetch('/api/staff/local-login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (json?.session?.mustChangePassword) {
          setRedirecting(true);
          router.replace(`/staff/account?next=${encodeURIComponent(next)}&force=1`);
          router.refresh();
          return;
        }
      }
      setRedirecting(true);
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setError(String(e?.message || e));
      setBusy(false);
      setRedirecting(false);
    }
  }

  const pageLabel = isAdminHost ? 'Platform Admin Portal' : 'Staff Portal';
  const pageTitle = isAdminHost ? 'Wild Game Butcher Board Platform' : 'Wild Game Butcher Board';
  const pageSubtitle = isAdminHost
    ? 'Platform administration for processor setup, onboarding, billing, and shared system controls.'
    : 'Deer processing operations, intake, and pickup workflow in one place.';
  const panelTitle = isAdminHost ? 'Platform Admin Login' : mode === 'admin' ? 'Processor Admin Login' : 'Staff Login';
  const panelCopy = isAdminHost
    ? 'Use your platform admin email and password to manage processors, onboarding, and system-wide settings.'
    : mode === 'admin'
      ? 'Use your staff email and password to manage the processor, settings, reports, and team access.'
      : 'Enter the username and password your processor admin created for you.';
  const explainerCards = isAdminHost
    ? [
        {
          title: 'Platform Admin Only',
          body: 'This login is for Wild Game Butcher Board platform administrators managing processor setup, billing, onboarding, and shared system access.',
        },
        {
          title: 'Processor Staff Login',
          body: 'Processor admins and regular staff should sign in on the shared staff site instead of the platform admin hostname.',
        },
      ]
    : [
        {
          title: 'Processor Admin Login',
          body: 'Best for owners and managers who need email recovery, public site settings, staff management, and business reporting.',
        },
        {
          title: 'Staff Login',
          body: 'Best for front counter and production-floor staff using a simple username and password login created by the processor admin.',
        },
      ];

  return (
    <main style={{ maxWidth: 1080, margin: '34px auto', padding: '0 16px' }}>
      <div
        className="login-shell"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(360px, 460px)',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        <section
          className="login-hero"
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
                {pageLabel}
              </div>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: '#fff7e8' }}>{pageTitle}</h1>
              <div style={{ color: 'rgba(245,236,216,.78)', fontSize: 15 }}>
                {pageSubtitle}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {explainerCards.map((item) => (
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
            <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>{panelTitle}</div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {panelCopy}
            </p>
          </div>

          {!isAdminHost ? (
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
          ) : (
            <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
              Processor staff should use the shared staff site. This hostname is reserved for platform administration.
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          {mode === 'admin' ? (
            <>
              <div style={{ padding: 12, borderRadius: 14, background: '#f8fafc', border: '1px solid #dbe4ee', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                {isAdminHost
                  ? 'Platform admins use email and password to manage processors, onboarding, billing, and platform-wide controls.'
                  : 'Processor admins use email and password so they can recover their own access and manage the rest of the team.'}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>{isAdminHost ? 'Platform admin email' : 'Staff email'}</label>
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
                Local staff logins are created by a processor admin. Use the username and password they gave you.
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
            disabled={busy || redirecting}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '14px 16px',
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            {redirecting ? 'Opening Portal...' : busy ? 'Signing In...' : 'Sign In'}
          </button>
          {mode === 'admin' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
              <Link href={`/staff/forgot-password?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                Forgot password?
              </Link>
              {isAdminHost ? (
                <a href={`https://${(process.env.NEXT_PUBLIC_STAFF_HOSTNAME || 'staff.wildgamebutcherboard.com').trim().toLowerCase()}`} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                  Go to staff login
                </a>
              ) : null}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
              If you forget a local staff password, ask a processor admin to reset it from <strong>Staff Team</strong>.
            </div>
          )}
          </form>
        </section>
      </div>

      <style jsx>{`
        .login-shell {
          min-width: 0;
        }
        .login-hero {
          min-width: 0;
        }
        @media (max-width: 860px) {
          .login-shell {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .login-hero {
            padding: 18px !important;
            border-radius: 18px !important;
            gap: 14px !important;
          }
          .login-hero img {
            width: 56px !important;
            height: 56px !important;
            border-radius: 14px !important;
          }
          .login-hero h1 {
            font-size: 28px !important;
          }
        }
        @media (max-width: 640px) {
          .card {
            padding: 16px !important;
            border-radius: 18px !important;
          }
          .card form {
            gap: 12px !important;
          }
          .card input {
            padding: 14px 12px !important;
          }
          .card .btn {
            min-height: 48px;
          }
        }
      `}</style>
    </main>
  );
}
