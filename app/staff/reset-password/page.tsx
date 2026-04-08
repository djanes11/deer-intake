'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { setStaffAccessCookie } from '@/lib/staffSession';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowser();

    const syncSession = async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          const accessToken = data.session?.access_token;
          if (accessToken) setStaffAccessCookie(accessToken);
        } else {
          const { data } = await supabase.auth.getSession();
          const accessToken = data.session?.access_token;
          if (accessToken) setStaffAccessCookie(accessToken);
        }
        if (active) setReady(true);
      } catch (e: any) {
        if (active) {
          setError(String(e?.message || e));
          setReady(false);
        }
      }
    };

    void syncSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token;
      if (accessToken) {
        setStaffAccessCookie(accessToken);
        if (active) setReady(true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [searchParams]);

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
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) setStaffAccessCookie(accessToken);
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
                Account Recovery
              </div>
              <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: '#fff7e8' }}>Wild Game Butcher Board</h1>
              <div style={{ color: 'rgba(245,236,216,.78)', fontSize: 15 }}>
                Finish resetting your password and get back into the staff portal quickly.
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
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>What happens next</div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              Choose a new password for your email-based processor admin account. Once it is saved, you will be sent right back into the staff site.
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
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>Password guidance</div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              Use at least 8 characters and pick something you can remember easily on busy processing days.
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
              Choose New Password
            </div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>Set Your New Password</div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              This page only works when you arrive from a valid reset email link.
            </p>
          </div>

          {!ready ? (
            <div
              style={{
                color: error ? '#b91c1c' : '#475569',
                padding: 12,
                borderRadius: 12,
                background: error ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${error ? '#fecaca' : '#dbe4ee'}`,
                fontWeight: error ? 700 : 600,
              }}
            >
              {error || 'Waiting for a valid reset session...'}
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
                  placeholder="Enter a new password"
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
                {busy ? 'Saving...' : 'Save New Password'}
              </button>
            </form>
          )}

          <Link href={`/staff/login?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700, fontSize: 14 }}>
            Back to login
          </Link>
        </section>
      </div>
    </main>
  );
}
