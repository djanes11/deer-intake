'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const supabase = getSupabaseBrowser();
      const redirectTo = `${window.location.origin}/staff/reset-password?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setMessage('Password reset email sent. Open the link in that email to choose a new password.');
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
          <h1 style={{ margin: '6px 0 0', fontSize: 30 }}>Reset Password</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Enter your staff email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
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
          {message ? <div style={{ color: '#166534', fontSize: 14, fontWeight: 700 }}>{message}</div> : null}
          {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Sending...' : 'Send Reset Email'}
          </button>
          <Link href={`/staff/login?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700, fontSize: 14 }}>
            Back to login
          </Link>
        </form>
      </div>
    </main>
  );
}
