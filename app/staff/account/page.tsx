'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { clearStaffAccessCookie, setStaffAccessCookie } from '@/lib/staffSession';

export default function StaffAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        const userEmail = String(data.user?.email || '').trim();
        if (!userEmail) {
          clearStaffAccessCookie();
          router.replace('/staff/login?next=/staff/account');
          router.refresh();
          return;
        }
        if (active) setEmail(userEmail);
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
  }, [router]);

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
      setPassword('');
      setConfirmPassword('');
      setMessage('Password updated.');
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '36px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: '#f8fafc',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#cbd5e1' }}>
          Staff Account
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>My Account</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Manage the password for your email-based staff account without needing platform support.
        </div>
      </div>

      <section
        style={{
          border: '1px solid #d6dee8',
          borderRadius: 16,
          padding: 18,
          background: '#ffffff',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
          display: 'grid',
          gap: 14,
        }}
      >
        {loading ? (
          <div>Loading account...</div>
        ) : (
          <>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Signed in as</div>
              <div style={{ color: '#334155' }}>{email || 'Unknown user'}</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                Local username logins are managed by the processor admin and do not use this page.
              </div>
            </div>

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
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
