'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';

type TeamMembership = {
  id: string;
  processorId: string;
  email: string;
  userId: string;
  role: 'admin' | 'staff' | 'readonly';
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSignInAt?: string | null;
  authCreatedAt?: string | null;
};

export default function StaffTeamPage() {
  const [processorSlug, setProcessorSlug] = useState('');
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMembership['role']>('staff');
  const [inviting, setInviting] = useState(false);
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
        const res = await fetch('/api/staff/team', { headers, cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setProcessorSlug(String(json.processor?.slug || ''));
        setMemberships(json.memberships || []);
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMembership = (id: string, patch: Partial<TeamMembership>) =>
    setMemberships((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const inviteUser = async () => {
    setInviting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/staff/team', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setMemberships((prev) => {
        const next = prev.filter((row) => row.id !== json.membership.id);
        return [json.membership, ...next];
      });
      setEmail('');
      setRole('staff');
      setMessage(json.invited ? `Invite sent to ${email}` : `Added ${email} to this processor`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setInviting(false);
    }
  };

  const saveMembership = async (row: TeamMembership) => {
    setSavingId(row.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/staff/team', {
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
    maxWidth: 980,
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
          Processor Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Staff Team</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Invite staff and manage access for <strong>{processorSlug || 'this processor'}</strong> without needing platform admin help.
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
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Invite Staff Member</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 180px auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="staff@example.com"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMembership['role'])}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="readonly">Read-only</option>
            </select>
          </label>
          <button className="btn" type="button" onClick={() => void inviteUser()} disabled={inviting}>
            {inviting ? 'Sending...' : 'Invite'}
          </button>
        </div>
        <div style={{ color: '#475569', fontSize: 14 }}>
          If the email already belongs to an existing user, this just adds them to this processor. If it&apos;s new, they&apos;ll get an invite to set their password.
        </div>
      </section>

      <section style={panel}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Current Team</div>
        {loading ? (
          <div>Loading team...</div>
        ) : memberships.length === 0 ? (
          <div style={{ color: '#64748b' }}>No staff memberships yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {memberships.map((row) => (
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

                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: 12, alignItems: 'end' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
                    <select
                      value={row.role}
                      onChange={(e) => updateMembership(row.id, { role: e.target.value as TeamMembership['role'] })}
                      style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="readonly">Read-only</option>
                    </select>
                  </label>
                  <div style={{ color: '#64748b', fontSize: 13 }}>
                    Joined: {row.authCreatedAt ? new Date(row.authCreatedAt).toLocaleDateString() : 'Pending invite'}
                  </div>
                  <button className="btn" type="button" onClick={() => void saveMembership(row)} disabled={savingId === row.id}>
                    {savingId === row.id ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
