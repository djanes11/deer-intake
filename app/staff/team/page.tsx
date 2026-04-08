'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { tokenHeader } from '@/lib/api';

type TeamMembership = {
  id: string;
  processorId: string;
  accountType: 'email' | 'local';
  email: string;
  username: string;
  userId: string;
  role: 'admin' | 'staff' | 'readonly';
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSignInAt?: string | null;
  authCreatedAt?: string | null;
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #d6dee8',
  borderRadius: 16,
  padding: 18,
  background: '#ffffff',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  display: 'grid',
  gap: 14,
};

function teamLabel(row: TeamMembership) {
  return row.accountType === 'local' ? row.username : row.email;
}

function teamTypeLabel(row: TeamMembership) {
  return row.accountType === 'local' ? 'Local login' : 'Email login';
}

export default function StaffTeamPage() {
  const [processorSlug, setProcessorSlug] = useState('');
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState<'admin' | 'staff' | 'readonly'>('admin');
  const [creatingEmail, setCreatingEmail] = useState(false);

  const [username, setUsername] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [localRole, setLocalRole] = useState<'staff' | 'readonly'>('staff');
  const [creatingLocal, setCreatingLocal] = useState(false);

  const [savingId, setSavingId] = useState('');
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

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
        setMemberships((json.memberships || []) as TeamMembership[]);
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

  const addOrReplaceMembership = (nextRow: TeamMembership) =>
    setMemberships((prev) => {
      const rest = prev.filter((row) => row.id !== nextRow.id);
      return [nextRow, ...rest];
    });

  const createEmailUser = async () => {
    setCreatingEmail(true);
    setError('');
    setMessage('');
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/staff/team', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountType: 'email',
          email: trimmedEmail,
          role: emailRole,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      addOrReplaceMembership(json.membership);
      setEmail('');
      setEmailRole('admin');
      setMessage(json.invited ? `Invite sent to ${trimmedEmail}` : `Added ${trimmedEmail} to this processor`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreatingEmail(false);
    }
  };

  const createLocalUser = async () => {
    setCreatingLocal(true);
    setError('');
    setMessage('');
    const trimmedUsername = username.trim().toLowerCase();
    try {
      const res = await fetch('/api/staff/team', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountType: 'local',
          username: trimmedUsername,
          password: localPassword,
          role: localRole,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      addOrReplaceMembership(json.membership);
      setUsername('');
      setLocalPassword('');
      setLocalRole('staff');
      setMessage(`Created local login ${trimmedUsername}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreatingLocal(false);
    }
  };

  const saveMembership = async (row: TeamMembership) => {
    setSavingId(row.id);
    setError('');
    setMessage('');
    const passwordDraft = (passwordDrafts[row.id] || '').trim();
    try {
      const res = await fetch('/api/staff/team', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: row.id,
          accountType: row.accountType,
          role: row.role,
          active: row.active,
          ...(row.accountType === 'local' && passwordDraft ? { password: passwordDraft } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setMemberships((prev) => prev.map((item) => (item.id === row.id ? json.membership : item)));
      if (passwordDraft) {
        setPasswordDrafts((prev) => ({ ...prev, [row.id]: '' }));
      }
      setMessage(
        row.accountType === 'local'
          ? `Saved ${row.username}${passwordDraft ? ' and reset password' : ''}`
          : `Saved ${row.email}`
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSavingId('');
    }
  };

  const shell: React.CSSProperties = {
    maxWidth: 1040,
    margin: '24px auto',
    padding: '0 16px 40px',
    display: 'grid',
    gap: 16,
  };
  const adminCount = memberships.filter((row) => row.role === 'admin').length;
  const localCount = memberships.filter((row) => row.accountType === 'local').length;
  const activeCount = memberships.filter((row) => row.active).length;
  const inactiveCount = memberships.length - activeCount;

  return (
    <main style={shell}>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #161718 0%, #23262a 100%)',
          color: '#f8fafc',
          border: '1px solid rgba(214, 173, 91, 0.22)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#d9c7a0',
          }}
        >
          Processor Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Staff Team</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Manage the team for <strong>{processorSlug || 'this processor'}</strong>. Use email logins for processor admins and
          simple username/password logins for back-room or seasonal staff.
        </div>
      </div>

      <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #d6dee8', color: '#475569', lineHeight: 1.5 }}>
        Recommended setup: keep <strong>owners/managers</strong> on email logins so they can reset their own password, and create
        <strong> local logins</strong> for seasonal staff, family members, or anyone who just needs a simple username and password. Local usernames are unique across the platform, so choose something distinctive for your shop.
      </div>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Active logins', value: activeCount, note: inactiveCount ? `${inactiveCount} inactive` : 'No inactive users' },
          { label: 'Processor admins', value: adminCount, note: 'Email-based accounts with recovery' },
          { label: 'Local staff logins', value: localCount, note: 'Simple usernames for day-to-day use' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: '1px solid #d6dee8',
              borderRadius: 14,
              background: '#ffffff',
              padding: 16,
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#0f172a' }}>{item.value}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>{item.note}</div>
          </div>
        ))}
      </section>

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

      <section
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Add Processor Admin</div>
          <div style={{ color: '#475569', lineHeight: 1.5 }}>
            Processor admins use email and password so they can recover their own account and manage other staff later.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
                placeholder="owner@processor.com"
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
              <select
                value={emailRole}
                onChange={(e) => setEmailRole(e.target.value as 'admin' | 'staff' | 'readonly')}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="readonly">Read-only</option>
              </select>
            </label>
            <button className="btn" type="button" onClick={() => void createEmailUser()} disabled={creatingEmail}>
              {creatingEmail ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            If the email already belongs to an existing user, this just adds them to this processor. If it&apos;s new, they&apos;ll get an invite
            to set their password.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Add Staff Login</div>
          <div style={{ color: '#475569', lineHeight: 1.5 }}>
            These are simple local logins for regular staff. They do not need email, and you can reset their password here anytime.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
                placeholder="mcafee-frontdesk"
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Temporary Password</span>
              <input
                type="password"
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
                placeholder="At least 8 characters"
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
              <select
                value={localRole}
                onChange={(e) => setLocalRole(e.target.value as 'staff' | 'readonly')}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              >
                <option value="staff">Staff</option>
                <option value="readonly">Read-only</option>
              </select>
            </label>
            <button className="btn" type="button" onClick={() => void createLocalUser()} disabled={creatingLocal}>
              {creatingLocal ? 'Creating...' : 'Create Login'}
            </button>
          </div>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Best for seasonal help, family members, or shop staff who just need a simple username and password. Usernames are unique across all processors, so it helps to use a shop-specific name like <strong>mcafee-frontdesk</strong>.
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Current Team</div>
        <div style={{ color: '#475569', lineHeight: 1.5 }}>
          Save changes after adjusting a role, turning access on or off, or resetting a local password.
        </div>
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{teamLabel(row)}</div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '.05em',
                          textTransform: 'uppercase',
                          color: row.accountType === 'local' ? '#92400e' : '#1d4ed8',
                          background: row.accountType === 'local' ? '#fff7ed' : '#eff6ff',
                          border: `1px solid ${row.accountType === 'local' ? '#fed7aa' : '#bfdbfe'}`,
                          padding: '4px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {teamTypeLabel(row)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '.05em',
                          textTransform: 'uppercase',
                          color: row.active ? '#166534' : '#991b1b',
                          background: row.active ? '#ecfdf5' : '#fef2f2',
                          border: `1px solid ${row.active ? '#bbf7d0' : '#fecaca'}`,
                          padding: '4px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                      Last sign-in: {row.lastSignInAt ? formatDisplayDateTime(row.lastSignInAt) : row.accountType === 'local' ? 'Not tracked yet' : 'Never'}
                    </div>
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                    <input type="checkbox" checked={row.active} onChange={(e) => updateMembership(row.id, { active: e.target.checked })} />
                    Active
                  </label>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: row.accountType === 'local' ? 'minmax(180px, 220px) minmax(220px, 1fr) minmax(140px, 1fr) auto' : 'minmax(180px, 220px) minmax(140px, 1fr) auto',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Role</span>
                    <select
                      value={row.role}
                      onChange={(e) => updateMembership(row.id, { role: e.target.value as TeamMembership['role'] })}
                      style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                    >
                      {row.accountType === 'local' ? null : <option value="admin">Admin</option>}
                      <option value="staff">Staff</option>
                      <option value="readonly">Read-only</option>
                    </select>
                  </label>

                  {row.accountType === 'local' ? (
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>Reset Password</span>
                      <input
                        type="password"
                        value={passwordDrafts[row.id] || ''}
                        onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
                        placeholder="Leave blank to keep current password"
                      />
                      <div style={{ color: '#64748b', fontSize: 12 }}>Enter a new password only when you want to reset this login.</div>
                    </label>
                  ) : null}

                  <div style={{ display: 'grid', gap: 4, color: '#64748b', fontSize: 13 }}>
                    <div>
                      Joined:{' '}
                      {row.accountType === 'email'
                        ? row.authCreatedAt
                          ? formatDisplayDate(row.authCreatedAt)
                          : 'Pending invite'
                        : row.createdAt
                          ? formatDisplayDate(row.createdAt)
                          : 'Recently created'}
                    </div>
                    <div>Access: {row.role === 'readonly' ? 'Read-only' : row.role === 'admin' ? 'Admin' : 'Staff'}</div>
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
