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
    <main style={{ maxWidth: 460, margin: '48px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
            Wild Game Butcher Board
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30 }}>Choose New Password</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Set a new password for your email-based staff account.
          </p>
        </div>

        {!ready ? (
          <div style={{ color: error ? '#b91c1c' : '#475569' }}>
            {error || 'Waiting for a valid reset session...'}
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label>New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Use at least 8 characters.</div>
            </div>
            <div>
              <label>Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {message ? <div style={{ color: '#166534', fontSize: 14, fontWeight: 700 }}>{message}</div> : null}
            {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}

        <Link href={`/staff/login?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700, fontSize: 14 }}>
          Back to login
        </Link>
      </div>
    </main>
  );
}
