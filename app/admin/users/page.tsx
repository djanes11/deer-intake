'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';

type ProcessorOption = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
};

type MembershipRow = {
  id: string;
  processorId: string;
  processorSlug: string;
  processorName: string;
  email: string;
  userId: string;
  role: 'admin' | 'staff' | 'readonly';
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSignInAt?: string | null;
  authCreatedAt?: string | null;
};

type FormState = {
  email: string;
  password: string;
  processorId: string;
  role: MembershipRow['role'];
  platformAdmin: boolean;
};

const EMPTY_FORM: FormState = {
  email: '',
  password: '',
  processorId: '',
  role: 'staff',
  platformAdmin: false,
};

export default function AdminUsersPage() {
  const [processors, setProcessors] = useState<ProcessorOption[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
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
      setError('');
      try {
        const res = await fetch('/api/admin/users', { headers, cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setProcessors(json.processors || []);
        setMemberships(json.memberships || []);
        if ((json.processors || [])[0]?.id) {
          setForm((prev) => ({ ...prev, processorId: prev.processorId || json.processors[0].id }));
        }
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProcessors = processors.filter((processor) => processor.active);

  const groupedMemberships = memberships.reduce<Record<string, MembershipRow[]>>((acc, row) => {
    const key = row.processorName || row.processorSlug || 'Unassigned';
    acc[key] ||= [];
    acc[key].push(row);
    return acc;
  }, {});

  const updateMembership = (id: string, patch: Partial<MembershipRow>) =>
    setMemberships((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const createUser = async () => {
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      if (json.membership) {
        setMemberships((prev) => {
          const next = prev.filter((row) => row.id !== json.membership.id);
          return [json.membership, ...next];
        });
      }
      setForm((prev) => ({ ...EMPTY_FORM, processorId: prev.processorId || activeProcessors[0]?.id || '' }));
      setMessage(json.created ? `Created ${form.email}` : `Updated access for ${form.email}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  };

  const saveMembership = async (row: MembershipRow) => {
    setSavingId(row.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: row.id,
          role: row.role,
          active: row.active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setMemberships((prev) => prev.map((item) => (item.id === row.id ? json.membership : item)));
      setMessage(`Saved ${row.email}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingId('');
    }
  };

  const shell: React.CSSProperties = {
    maxWidth: 1180,
    margin: '24px auto',
    padding: '0 16px 40px',
    display: 'grid',
    gap: 16,
  };

  const panel: React.CSSProperties = {
    border: '1px solid #d6dee8',
    borderRadius: 16,
    padding: 18,
    background: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    display: 'grid',
    gap: 14,
  };

  return (
    <main style={shell}>
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
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Staff Users</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Create staff logins, attach them to processors, and manage their access without touching Supabase SQL.
        </div>
      </div>

      {message ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 800 }}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      <section style={panel}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Create Staff User</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Email</span>
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="staff@example.com"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Temporary password</span>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="At least 8 characters"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Processor</span>
            <select
              value={form.processorId}
              onChange={(e) => setForm((prev) => ({ ...prev, processorId: e.target.value }))}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              disabled={form.platformAdmin}
            >
              {activeProcessors.map((processor) => (
                <option key={processor.id} value={processor.id}>
                  {processor.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as MembershipRow['role'] }))}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="readonly">Read-only</option>
            </select>
          </label>
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
          <input
            type="checkbox"
            checked={form.platformAdmin}
            onChange={(e) => setForm((prev) => ({ ...prev, platformAdmin: e.target.checked }))}
          />
          Also grant platform admin access
        </label>

        <div style={{ color: '#475569', fontSize: 14 }}>
          This first version creates the auth user immediately with the password you enter here. Later we can replace this with an invite flow.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => void createUser()} disabled={creating}>
            {creating ? 'Creating...' : 'Create Staff User'}
          </button>
        </div>
      </section>

      <section style={panel}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Current Memberships</div>
        {loading ? (
          <div>Loading users...</div>
        ) : memberships.length === 0 ? (
          <div style={{ color: '#64748b' }}>No staff memberships found yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {Object.entries(groupedMemberships).map(([processorName, rows]) => (
              <section key={processorName} style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>{processorName}</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        border: '1px solid #d6dee8',
                        borderRadius: 14,
                        padding: 14,
                        background: '#f8fafc',
                        display: 'grid',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 900, color: '#0f172a' }}>{row.email}</div>
                          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                            Last sign-in: {row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : 'Never'}
                          </div>
                        </div>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                          <input type="checkbox" checked={row.active} onChange={(e) => updateMembership(row.id, { active: e.target.checked })} />
                          Active
                        </label>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
                          <select
                            value={row.role}
                            onChange={(e) => updateMembership(row.id, { role: e.target.value as MembershipRow['role'] })}
                            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                            <option value="readonly">Read-only</option>
                          </select>
                        </label>
                        <div style={{ fontSize: 13, color: '#64748b', alignSelf: 'end' }}>
                          Created: {row.authCreatedAt ? new Date(row.authCreatedAt).toLocaleDateString() : 'Unknown'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn" type="button" onClick={() => void saveMembership(row)} disabled={savingId === row.id}>
                          {savingId === row.id ? 'Saving...' : 'Save Access'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
