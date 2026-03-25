'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';

type HourRow = {
  label: string;
  value: string;
};

type SiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: HourRow[];
  updated_at?: string;
};

const DEFAULT_HOURS: HourRow[] = [
  { label: 'Mon-Fri', value: '6-8 pm' },
  { label: 'Sat', value: '9-5' },
  { label: 'Sun', value: '9-12' },
  { label: 'After Hours', value: 'Overnight drop available' },
];

function normalizeHours(hours: any): HourRow[] {
  if (!Array.isArray(hours) || !hours.length) return DEFAULT_HOURS;
  const rows = hours.map((row) => ({
    label: String(row?.label || ''),
    value: String(row?.value || ''),
  }));
  return rows.length ? rows : DEFAULT_HOURS;
}

export default function AdminSettingsPage() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const headers: Record<string, string> = useMemo(
    () => ({
      'content-type': 'application/json',
      ...tokenHeader(),
    }),
    []
  );

  const load = async () => {
    setMsg('');
    const res = await fetch('/api/admin/site-settings', { headers, cache: 'no-store' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    setS({
      ...(j.settings as SiteSettings),
      hours: normalizeHours(j?.settings?.hours),
    });
  };

  useEffect(() => {
    load().catch((e) => setMsg(String((e as any)?.message || e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!s) return;
    setBusy(true);
    setMsg('');
    try {
      const payload = {
        ...s,
        hours: normalizeHours(s.hours).filter((row) => row.label.trim() || row.value.trim()),
      };
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setS({
        ...(j.settings as SiteSettings),
        hours: normalizeHours(j?.settings?.hours),
      });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const updateHour = (index: number, key: keyof HourRow, value: string) => {
    if (!s) return;
    const nextHours = normalizeHours(s.hours).map((row, i) => (i === index ? { ...row, [key]: value } : row));
    setS({ ...s, hours: nextHours });
  };

  if (!s) return <div style={{ padding: 16 }}>Loading... {msg ? <div>{msg}</div> : null}</div>;

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: 16 }}>
      <h2 style={{ margin: '0 0 10px' }}>Public Site Settings</h2>

      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            padding: 14,
            background: '#f8fafc',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>Public Intake</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900 }}>
            <input
              type="checkbox"
              checked={!!s.public_intake_enabled}
              onChange={(e) => setS({ ...s, public_intake_enabled: e.target.checked })}
            />
            Public overnight intake enabled
          </label>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Turn this off when you are at capacity or temporarily closed. The public pages will show the intake as unavailable.
          </div>
        </div>

        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            padding: 14,
            background: '#f8fafc',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>Banner</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900 }}>
            <input
              type="checkbox"
              checked={!!s.banner_enabled}
              onChange={(e) => setS({ ...s, banner_enabled: e.target.checked })}
            />
            Show public banner
          </label>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Banner message</div>
            <textarea
              rows={3}
              value={s.banner_message || ''}
              onChange={(e) => setS({ ...s, banner_message: e.target.value })}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              placeholder="Example: We are currently full and not accepting overnight drop-offs."
            />
          </div>
        </div>

        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            padding: 14,
            background: '#f8fafc',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>Pickup Hours</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            These rows show on the public Hours page and any public page that uses the public hours feed.
          </div>

          {normalizeHours(s.hours).map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <input
                value={row.label}
                onChange={(e) => updateHour(idx, 'label', e.target.value)}
                placeholder="Label"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
              <input
                value={row.value}
                onChange={(e) => updateHour(idx, 'value', e.target.value)}
                placeholder="Hours"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setS({ ...s, hours: [...normalizeHours(s.hours), { label: '', value: '' }] })}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Add Row
            </button>
            <button
              type="button"
              onClick={() => setS({ ...s, hours: DEFAULT_HOURS })}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Defaults
            </button>
          </div>
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
            {busy ? 'Saving...' : 'Save'}
          </button>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{msg}</div>
        </div>
      </div>
    </div>
  );
}
