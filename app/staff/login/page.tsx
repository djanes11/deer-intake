'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { STAFF_ACCESS_COOKIE } from '@/lib/staffSession';

function setStaffCookie(accessToken: string) {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STAFF_ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax${secure}`;
}

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get('next') || '/', [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('No session returned from Supabase.');
      setStaffCookie(accessToken);
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
          {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
