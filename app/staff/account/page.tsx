'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { clearLocalStaffSessionCookie, clearStaffAccessCookie, setStaffAccessCookie } from '@/lib/staffSession';

export default function StaffAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const force = useMemo(() => searchParams.get('force') === '1', [searchParams]);
  const [identifier, setIdentifier] = useState('');
  const [authType, setAuthType] = useState<'supabase' | 'local' | 'none'>('none');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const resp = await fetch('/api/admin/staff-context', { cache: 'no-store' });
        const json = await resp.json().catch(() => ({}));
        if (!json?.ok || !json?.identity?.authType || json.identity.authType === 'none') {
          clearStaffAccessCookie();
          clearLocalStaffSessionCookie();
          router.replace(`/staff/login?next=${encodeURIComponent('/staff/account')}`);
          router.refresh();
          return;
        }
        if (active) {
          const nextAuthType = json.identity.authType === 'local' ? 'local' : 'supabase';
          if (nextAuthType === 'local' && !(json.identity.mustChangePassword || force)) {
            router.replace(next || '/');
            router.refresh();
            return;
          }
          setAuthType(nextAuthType);
          setIdentifier(
            nextAuthType === 'local'
              ? String(json.identity.username || '')
              : String(json.identity.email || '').trim()
          );
          setMustChangePassword(!!json.identity.mustChangePassword);
        }
      } catch (e: any) {
        if (active) setError(String(e?.message || e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [force, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      if (authType === 'local') {
        const res = await fetch('/api/staff/local-account', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password, confirmPassword }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setMustChangePassword(false);
      } else {
        const supabase = getSupabaseBrowser();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) setStaffAccessCookie(accessToken);

        const completeRes = await fetch('/api/staff/account', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ completePasswordChange: true }),
        });
        const completeJson = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok || !completeJson?.ok) {
          throw new Error(completeJson?.error || `HTTP ${completeRes.status}`);
        }
        setMustChangePassword(false);
      }

      setPassword('');
      setConfirmPassword('');
      setMessage('Password updated. Sending you back to staff...');
      setTimeout(() => {
        router.replace(next);
        router.refresh();
      }, 900);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const isLocal = authType === 'local';
  const showForcedState = force || mustChangePassword;

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
                Staff Account
              </div>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: '#fff7e8' }}>Wild Game Butcher Board</h1>
              <div style={{ color: 'rgba(245,236,216,.78)', fontSize: 15 }}>
                {showForcedState
                  ? 'Choose a secure permanent password before returning to the staff portal.'
                  : 'Manage your account password without needing platform support.'}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>
              {isLocal ? 'Temporary local password' : 'Email account security'}
            </div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              {isLocal
                ? 'Your processor admin can create or reset a temporary password, but you finish the process here by choosing one you want to keep.'
                : 'Email-based staff users can update their own password here anytime, and temporary passwords from platform setup are cleared after you save a new one.'}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>Signed in as</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff7e8' }}>{identifier || 'Loading...'}</div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              {showForcedState
                ? 'This password is temporary. Save a new one below before returning to the rest of the app.'
                : 'Use at least 8 characters and choose something that is easy to remember during busy processing days.'}
            </div>
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
              {showForcedState ? 'Finish Sign In' : 'Account Settings'}
            </div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>
              {showForcedState ? 'Set Your Password' : 'Update Password'}
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {isLocal
                ? 'Local staff accounts only use this page when a temporary password must be replaced.'
                : 'Email-based staff accounts can use this page anytime to keep access secure.'}
            </p>
          </div>

          {loading ? (
            <div
              style={{
                color: '#475569',
                padding: 12,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #dbe4ee',
                fontWeight: 600,
              }}
            >
              Loading account...
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
                <div style={{ color: '#64748b', fontSize: 13 }}>Use at least 8 characters.</div>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontWeight: 800, color: '#0f172a' }}>Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  style={{ padding: '13px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)' }}
                />
              </div>

              {showForcedState ? (
                <div style={{ color: '#92400e', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  This password is temporary. Save a new one here before returning to the staff site.
                </div>
              ) : null}

              {message ? (
                <div style={{ color: '#166534', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  {message}
                </div>
              ) : null}
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
                {busy ? 'Saving...' : showForcedState ? 'Save And Continue' : 'Update Password'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
