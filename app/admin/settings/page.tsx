'use client';

import { useEffect, useState } from 'react';

type SiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: any;
  updated_at?: string;
};

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_SETTINGS_TOKEN || '';

export default function AdminSettingsPage() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (ADMIN_TOKEN) headers['x-admin-token'] = ADMIN_TOKEN;

  const load = async () => {
    setMsg('');
    const res = await fetch('/api/admin/site-settings', { headers, cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    setS(j.settings as SiteSettings);
  };

  useEffect(() => {
    load().catch((e) => setMsg(String((e as any)?.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(s),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setS(j.settings as SiteSettings);
      setMsg('Saved ✓');
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <div style={{ padding: 16 }}>Loading… {msg ? <div>{msg}</div> : null}</div>;

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 16 }}>
      <h2 style={{ margin: '0 0 10px' }}>Public Site Settings</h2>

      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900 }}>
          <input
            type="checkbox"
            checked={!!s.public_intake_enabled}
            onChange={(e) => setS({ ...s, public_intake_enabled: e.target.checked })}
          />
          Public intake enabled
        </label>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900 }}>
          <input
            type="checkbox"
            checked={!!s.banner_enabled}
            onChange={(e) => setS({ ...s, banner_enabled: e.target.checked })}
          />
          Banner enabled
        </label>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Banner message</div>
          <textarea
            rows={3}
            value={s.banner_message || ''}
            onChange={(e) => setS({ ...s, banner_message: e.target.value })}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div style={{ fontSize: 12, color: '#475569', fontWeight: 800 }}>
          Hours editing next. (We’ll add a proper editor instead of raw JSON.)
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={save}
            disabled={busy}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#155acb',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{msg}</div>
        </div>
      </div>
    </div>
  );
}
