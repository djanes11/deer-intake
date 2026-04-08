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
                Reset email-based processor admin passwords without needing platform support.
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
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>Who this is for</div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              This reset flow is only for <strong>email-based processor admin accounts</strong>. Local staff usernames do not use email reset links.
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
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff7e8' }}>Local staff accounts</div>
            <div style={{ lineHeight: 1.55, color: 'rgba(245,236,216,.78)' }}>
              If a regular staff user forgets a local username/password login, a processor admin can reset it from <strong>Staff Team</strong>.
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
              Password Reset
            </div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>Send Reset Email</div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Enter the email address for the processor admin account you want to reset.
            </p>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
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
              {busy ? 'Sending...' : 'Send Reset Email'}
            </button>

            <Link href={`/staff/login?next=${encodeURIComponent(next)}`} style={{ color: '#1d4ed8', fontWeight: 700, fontSize: 14 }}>
              Back to login
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
