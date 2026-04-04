'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';

type ProcessorRow = {
  id: string;
  slug: string;
  name: string;
  publicName: string;
  active: boolean;
  publicHostname: string;
  staffHostname: string;
  features: {
    plan: 'basic' | 'texting' | 'custom';
    smsEnabled: boolean;
    webbsEnabled: boolean;
  };
  updatedAt?: string | null;
};

export default function AdminProcessorsPage() {
  const [rows, setRows] = useState<ProcessorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState('');

  const headers = useMemo(
    () => ({
      'content-type': 'application/json',
      ...tokenHeader(),
    }),
    []
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg('');
      try {
        const res = await fetch('/api/admin/processors', { headers, cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setRows(json.rows || []);
      } catch (e: any) {
        setMsg(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (id: string, patch: Partial<ProcessorRow>) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const updateFeatures = (id: string, patch: Partial<ProcessorRow['features']>) =>
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, features: { ...row.features, ...patch } } : row))
    );

  const saveRow = async (row: ProcessorRow) => {
    setSavingId(row.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin/processors', {
        method: 'POST',
        headers,
        body: JSON.stringify(row),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRows((prev) => prev.map((item) => (item.id === row.id ? json.row : item)));
      setMsg(`Saved ${row.slug}`);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setSavingId('');
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
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
          Platform Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Processor Management</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Manage processor plan tiers, feature flags, and shared deployment hostnames from one place.
        </div>
      </div>

      {msg ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 800 }}>
          {msg}
        </div>
      ) : null}

      {loading ? (
        <div className="card" style={{ padding: 18 }}>Loading processors...</div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {rows.map((row) => (
            <section
              key={row.id}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>{row.name}</div>
                  <div style={{ color: '#475569', marginTop: 4 }}>
                    Slug: <code>{row.slug}</code>
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={row.active} onChange={(e) => updateRow(row.id, { active: e.target.checked })} />
                  Processor active
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Public hostname</span>
                  <input value={row.publicHostname} onChange={(e) => updateRow(row.id, { publicHostname: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Staff hostname</span>
                  <input value={row.staffHostname} onChange={(e) => updateRow(row.id, { staffHostname: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Plan tier</span>
                  <select value={row.features.plan} onChange={(e) => updateFeatures(row.id, { plan: e.target.value as ProcessorRow['features']['plan'] })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>
                    <option value="basic">Basic</option>
                    <option value="texting">Texting</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={row.features.smsEnabled} onChange={(e) => updateFeatures(row.id, { smsEnabled: e.target.checked })} />
                  SMS enabled
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={row.features.webbsEnabled} onChange={(e) => updateFeatures(row.id, { webbsEnabled: e.target.checked })} />
                  Webbs/custom workflow enabled
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Updated: {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Never'}
                </div>
                <button className="btn" type="button" onClick={() => void saveRow(row)} disabled={savingId === row.id}>
                  {savingId === row.id ? 'Saving...' : 'Save Processor'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
