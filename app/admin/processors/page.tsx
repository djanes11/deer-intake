'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
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
  billingStatus: 'setup' | 'trial' | 'active' | 'past_due' | 'paused' | 'internal';
  billingCycle: 'monthly' | 'seasonal' | 'annual' | 'custom';
  monthlyPrice: number | null;
  setupFee: number | null;
  perDeerRate: number | null;
  trialEndsAt?: string | null;
  subscriptionStartedAt?: string | null;
  goLiveAt?: string | null;
  setupCompletedAt?: string | null;
  billingNotes?: string;
  updatedAt?: string | null;
  onboarding: {
    readyCount: number;
    totalCount: number;
    readyToGoLive: boolean;
    items: Array<{
      key: string;
      label: string;
      done: boolean;
      note: string;
    }>;
  };
};

type CreatedProcessorSummary = {
  id: string;
  slug: string;
  publicName: string;
  publicHostname: string;
  staffHostname: string;
  firstAdminEmail: string;
  firstAdminCreated: boolean;
};

type CreateProcessorForm = {
  slug: string;
  name: string;
  publicName: string;
  publicHostname: string;
  staffHostname: string;
  firstAdminEmail: string;
  firstAdminPassword: string;
  features: ProcessorRow['features'];
  billingStatus: ProcessorRow['billingStatus'];
  billingCycle: ProcessorRow['billingCycle'];
  monthlyPrice: string;
  setupFee: string;
  perDeerRate: string;
  trialEndsAt: string;
  subscriptionStartedAt: string;
  goLiveAt: string;
  setupCompletedAt: string;
  billingNotes: string;
};

function normalizedFeaturesForPlan(features: ProcessorRow['features']) {
  if (features.plan === 'basic') return { plan: 'basic' as const, smsEnabled: false, webbsEnabled: false };
  if (features.plan === 'texting') return { plan: 'texting' as const, smsEnabled: true, webbsEnabled: false };
  return { plan: 'custom' as const, smsEnabled: true, webbsEnabled: features.webbsEnabled };
}

const EMPTY_CREATE_FORM: CreateProcessorForm = {
  slug: '',
  name: '',
  publicName: '',
  publicHostname: '',
  staffHostname: '',
  firstAdminEmail: '',
  firstAdminPassword: '',
  features: {
    plan: 'basic',
    smsEnabled: false,
    webbsEnabled: false,
  },
  billingStatus: 'setup',
  billingCycle: 'monthly',
  monthlyPrice: '',
  setupFee: '',
  perDeerRate: '2',
  trialEndsAt: '',
  subscriptionStartedAt: '',
  goLiveAt: '',
  setupCompletedAt: '',
  billingNotes: '',
};

function dateInputValue(v?: string | null) {
  return v ? String(v).slice(0, 10) : '';
}

function lifecycleTone(status: ProcessorRow['billingStatus']) {
  switch (status) {
    case 'trial':
      return { bg: '#ecfccb', fg: '#3f6212' };
    case 'active':
      return { bg: '#dcfce7', fg: '#166534' };
    case 'past_due':
      return { bg: '#fee2e2', fg: '#991b1b' };
    case 'paused':
      return { bg: '#e2e8f0', fg: '#334155' };
    case 'internal':
      return { bg: '#ede9fe', fg: '#6d28d9' };
    default:
      return { bg: '#fff7ed', fg: '#9a3412' };
  }
}

function suggestedPerDeerRate(plan: ProcessorRow['features']['plan']) {
  if (plan === 'custom') return 5;
  if (plan === 'texting') return 3;
  return 2;
}

export default function AdminProcessorsPage() {
  const [rows, setRows] = useState<ProcessorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [selectedId, setSelectedId] = useState('');
  const [createForm, setCreateForm] = useState<CreateProcessorForm>(EMPTY_CREATE_FORM);
  const [createdSummary, setCreatedSummary] = useState<CreatedProcessorSummary | null>(null);

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
        if ((json.rows || [])[0]?.id) setSelectedId((prev) => prev || json.rows[0].id);
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
      prev.map((row) => (row.id === id ? { ...row, features: normalizedFeaturesForPlan({ ...row.features, ...patch }) } : row))
    );

  const updateCreateForm = (patch: Partial<CreateProcessorForm>) =>
    setCreateForm((prev) => ({ ...prev, ...patch }));

  const updateCreateFeatures = (patch: Partial<CreateProcessorForm['features']>) =>
    setCreateForm((prev) => {
      const nextFeatures = normalizedFeaturesForPlan({ ...prev.features, ...patch });
      const previousSuggested = String(suggestedPerDeerRate(prev.features.plan));
      const nextSuggested = String(suggestedPerDeerRate(nextFeatures.plan));
      return {
        ...prev,
        features: nextFeatures,
        perDeerRate: !prev.perDeerRate || prev.perDeerRate === previousSuggested ? nextSuggested : prev.perDeerRate,
      };
    });

  const createProcessor = async () => {
    setCreating(true);
    setMsg('');
    try {
      const payload = {
        ...createForm,
        slug: createForm.slug.trim().toLowerCase(),
        name: createForm.name.trim(),
        publicName: createForm.publicName.trim(),
        publicHostname: createForm.publicHostname.trim().toLowerCase(),
        staffHostname: createForm.staffHostname.trim().toLowerCase(),
        firstAdminEmail: createForm.firstAdminEmail.trim().toLowerCase(),
      };
      const res = await fetch('/api/admin/processors', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRows((prev) => [json.row, ...prev]);
      setCreatedSummary({
        id: json.row.id,
        slug: json.row.slug,
        publicName: json.row.publicName,
        publicHostname: json.row.publicHostname || '',
        staffHostname: json.row.staffHostname || '',
        firstAdminEmail: payload.firstAdminEmail,
        firstAdminCreated: !!json.firstAdminCreated,
      });
      setMode('list');
      setSelectedId(json.row.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setMsg(
        json.firstAdminCreated
          ? `Created ${json.row.publicName} and set up the first processor admin.`
          : `Created ${json.row.publicName}.`
      );
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  };

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
  const selectedRow = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const updateSelectedRow = (patch: Partial<ProcessorRow>) => {
    if (!selectedRow) return;
    updateRow(selectedRow.id, patch);
  };
  const updateSelectedFeatures = (patch: Partial<ProcessorRow['features']>) => {
    if (!selectedRow) return;
    updateFeatures(selectedRow.id, patch);
  };
  const summaryCards = [
    { label: 'Processors', value: rows.length, note: 'Total processors in the platform' },
    { label: 'Active', value: rows.filter((row) => row.active).length, note: 'Currently enabled processors' },
    { label: 'Trials', value: rows.filter((row) => row.billingStatus === 'trial').length, note: 'Processors in trial status' },
    {
      label: 'Ready To Go Live',
      value: rows.filter((row) => row.onboarding?.readyToGoLive).length,
      note: 'Processors with checklist complete',
    },
  ];
  const navButton = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? '#e1c08b' : '#d6dee8'}`,
    background: active ? '#fff7eb' : '#ffffff',
    color: active ? '#7c4b17' : '#334155',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: active ? '0 8px 18px rgba(200,138,61,.12)' : '0 6px 14px rgba(15,23,42,.04)',
  });

  return (
    <main className="app-frame" style={{ maxWidth: 1220 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Platform Admin</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>Processor Management</h1>
            <div className="app-copy">
              Onboard processors, manage plan tiers and billing status, and check who is actually ready to go live from one place.
            </div>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>What belongs here</div>
            <div style={{ color: 'rgba(245,236,216,.82)', lineHeight: 1.55 }}>
              Use this page for platform-owned setup like hostnames, billing lifecycle, and plan access. Processor-facing branding and offerings stay inside Public Site Settings.
            </div>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="app-surface-light" style={{ padding: 12, borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 800 }}>
          {msg}
        </div>
      ) : null}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {summaryCards.map((item) => (
          <div key={item.label} className="app-surface-light" style={{ padding: 16, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 950, color: '#0f172a' }}>{item.value}</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <section className="app-surface-light" style={{ padding: 14, display: 'grid', gap: 12 }}>
        <div className="app-section-head">
          <div className="app-section-title">Platform Views</div>
          <div className="app-section-copy">Switch between the live processor list and the onboarding flow for a new processor.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setMode('list')} style={navButton(mode === 'list')}>
            Processor List
          </button>
          <button type="button" onClick={() => setMode('create')} style={navButton(mode === 'create')}>
            Onboard New Processor
          </button>
          <a href="/admin/processors/onboarding" style={{ textDecoration: 'none' }}>
            <div style={navButton(false)}>Guided Wizard</div>
          </a>
        </div>
      </section>

      {createdSummary ? (
        <section
          className="app-surface-light"
          style={{
            border: '1px solid #c7e7d0',
            padding: 18,
            background: 'linear-gradient(180deg, #f4fbf6 0%, #ffffff 100%)',
            display: 'grid',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#166534' }}>
                Processor Created
              </div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 28, lineHeight: 1.1, color: '#0f172a' }}>{createdSummary.publicName}</h2>
              <div style={{ color: '#334155', lineHeight: 1.55, maxWidth: 760 }}>
                The processor record is set up, default settings are seeded, and you can move straight into testing or handoff.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedSummary(null)}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                borderRadius: 12,
                padding: '10px 12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid #d6dee8', borderRadius: 14, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Slug</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: '#0f172a' }}>{createdSummary.slug}</div>
            </div>
            <div style={{ border: '1px solid #d6dee8', borderRadius: 14, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>First Admin</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: '#0f172a' }}>
                {createdSummary.firstAdminEmail || 'Not created yet'}
              </div>
              <div style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
                {createdSummary.firstAdminEmail
                  ? createdSummary.firstAdminCreated
                    ? 'New admin account created'
                    : 'Existing account attached to this processor'
                  : 'You can add one later from Staff Users'}
              </div>
            </div>
            <div style={{ border: '1px solid #d6dee8', borderRadius: 14, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Public Host</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: '#0f172a', wordBreak: 'break-word' }}>
                {createdSummary.publicHostname || 'Not set'}
              </div>
            </div>
            <div style={{ border: '1px solid #d6dee8', borderRadius: 14, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>Staff Host</div>
              <div style={{ marginTop: 6, fontWeight: 900, color: '#0f172a', wordBreak: 'break-word' }}>
                {createdSummary.staffHostname || 'Not set'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr .9fr',
              gap: 16,
            }}
          >
            <div
              style={{
                border: '1px solid #d6dee8',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Next Steps</div>
              <div style={{ display: 'grid', gap: 8, color: '#334155', lineHeight: 1.5 }}>
                <div>1. Verify the public and staff hostnames resolve correctly in Vercel.</div>
                <div>2. Sign in as the processor admin and update branding, phone, address, and pricing.</div>
                <div>3. Test a public intake and staff login for this processor.</div>
                <div>4. Add regular staff logins from the processor’s `Staff Team` page if needed.</div>
              </div>
            </div>

            <div
              style={{
                border: '1px solid #d6dee8',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Jump To</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {createdSummary.publicHostname ? (
                  <a
                    href={`https://${createdSummary.publicHostname}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="btn" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>Open Public Site</div>
                  </a>
                ) : null}
                {createdSummary.staffHostname ? (
                  <a
                    href={`https://${createdSummary.staffHostname}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="btn" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>Open Staff Site</div>
                  </a>
                ) : null}
                <a href="/admin/settings" style={{ textDecoration: 'none' }}>
                  <div className="btn secondary" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>Open Current Settings</div>
                </a>
                <a href="/admin/users" style={{ textDecoration: 'none' }}>
                  <div className="btn secondary" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>Open Staff Users</div>
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'create' ? (
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
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Onboard New Processor</div>
          <div style={{ color: '#475569', lineHeight: 1.5, maxWidth: 860 }}>
            Create the processor record, seed default settings, and optionally create the first processor admin login in one step.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Business name</span>
            <input
              value={createForm.name}
              onChange={(e) => updateCreateForm({ name: e.target.value, publicName: createForm.publicName || e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="Smith Family Processing"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Slug</span>
            <input
              value={createForm.slug}
              onChange={(e) => updateCreateForm({ slug: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="smith-family"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Public-facing name</span>
            <input
              value={createForm.publicName}
              onChange={(e) => updateCreateForm({ publicName: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="Smith Deer Processing"
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Public hostname</span>
            <input
              value={createForm.publicHostname}
              onChange={(e) => updateCreateForm({ publicHostname: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="smith.wildgamebutcherboard.com"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Staff hostname</span>
            <input
              value={createForm.staffHostname}
              onChange={(e) => updateCreateForm({ staffHostname: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="staff.wildgamebutcherboard.com"
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Plan tier</span>
            <select
              value={createForm.features.plan}
              onChange={(e) => updateCreateFeatures({ plan: e.target.value as ProcessorRow['features']['plan'] })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            >
              <option value="basic">Basic</option>
              <option value="texting">Texting</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
            <input type="checkbox" checked={createForm.features.smsEnabled} onChange={(e) => updateCreateFeatures({ smsEnabled: e.target.checked })} disabled />
            SMS enabled
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
            <input type="checkbox" checked={createForm.features.webbsEnabled} onChange={(e) => updateCreateFeatures({ webbsEnabled: e.target.checked })} disabled={createForm.features.plan !== 'custom'} />
            Webbs/custom workflow enabled
          </label>
        </div>

        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
          <strong>Plan rules:</strong> Basic = core workflow only. Texting = core workflow plus SMS. Custom = texting plus optional custom workflows like Webbs.
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontWeight: 900, color: '#0f172a' }}>Billing Lifecycle</div>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Track setup fee and per-deer billing here alongside lifecycle status. This fits your processor pricing better than a monthly subscription field.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing status</span>
            <select
              value={createForm.billingStatus}
              onChange={(e) => updateCreateForm({ billingStatus: e.target.value as ProcessorRow['billingStatus'] })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            >
              <option value="setup">Setup</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="paused">Paused</option>
              <option value="internal">Internal</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Setup fee</span>
            <input
              value={createForm.setupFee}
              onChange={(e) => updateCreateForm({ setupFee: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="Optional one-time fee"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Per deer rate</span>
            <input
              value={createForm.perDeerRate}
              onChange={(e) => updateCreateForm({ perDeerRate: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder={String(suggestedPerDeerRate(createForm.features.plan))}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Setup completed</span>
            <input
              type="date"
              value={createForm.setupCompletedAt}
              onChange={(e) => updateCreateForm({ setupCompletedAt: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Trial ends</span>
            <input
              type="date"
              value={createForm.trialEndsAt}
              onChange={(e) => updateCreateForm({ trialEndsAt: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Go live</span>
            <input
              type="date"
              value={createForm.goLiveAt}
              onChange={(e) => updateCreateForm({ goLiveAt: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            />
          </label>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
          Suggested deer rate for this plan: <strong style={{ color: '#0f172a' }}>${suggestedPerDeerRate(createForm.features.plan).toFixed(2)}/deer</strong>
          {' '}
          ({createForm.features.plan === 'basic' ? 'regular workflow' : createForm.features.plan === 'texting' ? 'regular + texting' : 'custom workflow adjustments'}).
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing notes</span>
          <textarea
            value={createForm.billingNotes}
            onChange={(e) => updateCreateForm({ billingNotes: e.target.value })}
            rows={3}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', resize: 'vertical' }}
            placeholder="Trial through opening weekend, pricing still being finalized, or any special arrangement."
          />
        </label>

        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
          Marking <strong>Setup completed</strong> will automatically move a processor from <strong>Setup</strong> into <strong>Trial</strong> if they are still in setup, and it will default the trial end date to two weeks later if you leave it blank.
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontWeight: 900, color: '#0f172a' }}>First Processor Admin</div>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Optional, but recommended. If you fill this in now, the new processor can sign in immediately after you create them.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Admin email</span>
            <input
              value={createForm.firstAdminEmail}
              onChange={(e) => updateCreateForm({ firstAdminEmail: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="owner@processor.com"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Temporary password</span>
            <input
              type="text"
              value={createForm.firstAdminPassword}
              onChange={(e) => updateCreateForm({ firstAdminPassword: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="At least 8 characters"
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            This seeds default pricing, hours, public settings, and processor features so the shop is ready to customize.
          </div>
          <button className="btn" type="button" onClick={() => void createProcessor()} disabled={creating}>
            {creating ? 'Creating...' : 'Create Processor'}
          </button>
        </div>
      </section>
      ) : (
      <>
        {loading ? (
          <div className="card" style={{ padding: 18 }}>Loading processors...</div>
        ) : !selectedRow ? (
          <div className="card" style={{ padding: 18 }}>No processors yet.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <aside
              style={{
                border: '1px solid #d6dee8',
                borderRadius: 16,
                padding: 18,
                background: '#ffffff',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Processors</div>
              <div style={{ color: '#475569', lineHeight: 1.5 }}>
                Choose one processor to edit its hostnames, features, and lifecycle details.
              </div>
              {rows.map((row) => {
                const tone = lifecycleTone(row.billingStatus);
                const selected = row.id === selectedRow.id;
                const onboardingReady = row.onboarding?.readyCount || 0;
                const onboardingTotal = row.onboarding?.totalCount || 0;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${selected ? '#bfdbfe' : '#d6dee8'}`,
                      borderRadius: 14,
                      padding: 14,
                      background: selected ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{row.name}</div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 900,
                          background: tone.bg,
                          color: tone.fg,
                          textTransform: 'capitalize',
                        }}
                      >
                        {row.billingStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>Slug: {row.slug}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {row.features.plan.charAt(0).toUpperCase() + row.features.plan.slice(1)} plan
                      {' • '}
                      {row.active ? 'Active' : 'Inactive'}
                    </div>
                    <div style={{ color: '#475569', fontSize: 13, fontWeight: 700 }}>
                      {row.perDeerRate != null ? `$${row.perDeerRate.toFixed(2)}/deer` : 'Deer rate not set'}
                      {row.setupFee != null ? ` • Setup $${row.setupFee.toFixed(2)}` : ''}
                    </div>
                    <div style={{ color: '#475569', fontSize: 13, fontWeight: 700 }}>
                      Onboarding: {onboardingReady}/{onboardingTotal || 6}
                    </div>
                  </button>
                );
              })}
            </aside>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>{selectedRow.name}</div>
                  <div style={{ color: '#475569', marginTop: 4 }}>
                    Slug: <code>{selectedRow.slug}</code>
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={selectedRow.active} onChange={(e) => updateSelectedRow({ active: e.target.checked })} />
                  Processor active
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Public hostname</span>
                  <input value={selectedRow.publicHostname} onChange={(e) => updateSelectedRow({ publicHostname: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Staff hostname</span>
                  <input value={selectedRow.staffHostname} onChange={(e) => updateSelectedRow({ staffHostname: e.target.value })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Plan tier</span>
                  <select value={selectedRow.features.plan} onChange={(e) => updateSelectedFeatures({ plan: e.target.value as ProcessorRow['features']['plan'] })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>
                    <option value="basic">Basic</option>
                    <option value="texting">Texting</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={selectedRow.features.smsEnabled} onChange={(e) => updateSelectedFeatures({ smsEnabled: e.target.checked })} disabled />
                  SMS enabled
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={selectedRow.features.webbsEnabled} onChange={(e) => updateSelectedFeatures({ webbsEnabled: e.target.checked })} disabled={selectedRow.features.plan !== 'custom'} />
                  Webbs/custom workflow enabled
                </label>
              </div>

              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, color: '#0f172a' }}>Lifecycle</div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: lifecycleTone(selectedRow.billingStatus).bg,
                      color: lifecycleTone(selectedRow.billingStatus).fg,
                      textTransform: 'capitalize',
                    }}
                  >
                    {selectedRow.billingStatus.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.55 }}>
                  Setup complete: {selectedRow.setupCompletedAt ? formatDisplayDate(selectedRow.setupCompletedAt) : 'Not marked yet'}.
                  {selectedRow.billingStatus === 'trial' && selectedRow.trialEndsAt ? ` Trial ends ${formatDisplayDate(selectedRow.trialEndsAt)}.` : ''}
                  {selectedRow.goLiveAt ? ` Go live ${formatDisplayDate(selectedRow.goLiveAt)}.` : ''}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing status</span>
                  <select value={selectedRow.billingStatus} onChange={(e) => updateSelectedRow({ billingStatus: e.target.value as ProcessorRow['billingStatus'] })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>
                    <option value="setup">Setup</option>
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="paused">Paused</option>
                    <option value="internal">Internal</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Setup fee</span>
                  <input value={selectedRow.setupFee ?? ''} onChange={(e) => updateSelectedRow({ setupFee: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} placeholder="Optional one-time fee" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Per deer rate</span>
                  <input value={selectedRow.perDeerRate ?? ''} onChange={(e) => updateSelectedRow({ perDeerRate: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} placeholder={String(suggestedPerDeerRate(selectedRow.features.plan))} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Setup completed</span>
                  <input type="date" value={dateInputValue(selectedRow.setupCompletedAt)} onChange={(e) => updateSelectedRow({ setupCompletedAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Trial ends</span>
                  <input type="date" value={dateInputValue(selectedRow.trialEndsAt)} onChange={(e) => updateSelectedRow({ trialEndsAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Go live</span>
                  <input type="date" value={dateInputValue(selectedRow.goLiveAt)} onChange={(e) => updateSelectedRow({ goLiveAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
              </div>

              <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
                Suggested rate for this plan: <strong style={{ color: '#0f172a' }}>${suggestedPerDeerRate(selectedRow.features.plan).toFixed(2)}/deer</strong>
                {' '}
                ({selectedRow.features.plan === 'basic' ? 'regular workflow' : selectedRow.features.plan === 'texting' ? 'regular + texting' : 'custom workflow adjustments'}).
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn secondary" type="button" onClick={() => updateSelectedRow({ setupCompletedAt: dateInputValue(new Date().toISOString()) })}>
                  Mark Setup Complete
                </button>
                <button className="btn secondary" type="button" onClick={() => updateSelectedRow({ goLiveAt: dateInputValue(new Date().toISOString()) })}>
                  Mark Go Live
                </button>
              </div>

              <div
                style={{
                  border: '1px solid #d6dee8',
                  borderRadius: 16,
                  padding: 16,
                  background: selectedRow.onboarding?.readyToGoLive ? '#f0fdf4' : '#f8fafc',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Go-Live Checklist</div>
                    <div style={{ color: '#475569', marginTop: 4 }}>
                      Quick readiness check before handoff, testing, or opening the processor to live traffic.
                    </div>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: selectedRow.onboarding?.readyToGoLive ? '#dcfce7' : '#fff7ed',
                      color: selectedRow.onboarding?.readyToGoLive ? '#166534' : '#9a3412',
                    }}
                  >
                    {selectedRow.onboarding?.readyCount || 0}/{selectedRow.onboarding?.totalCount || 0} complete
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {(selectedRow.onboarding?.items || []).map((item) => (
                    <div
                      key={item.key}
                      style={{
                        border: `1px solid ${item.done ? '#bbf7d0' : '#fed7aa'}`,
                        borderRadius: 14,
                        padding: 14,
                        background: item.done ? '#ffffff' : '#fffaf0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'start',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ fontWeight: 900, color: '#0f172a' }}>{item.label}</div>
                        <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>{item.note}</div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                          background: item.done ? '#dcfce7' : '#fee2e2',
                          color: item.done ? '#166534' : '#991b1b',
                        }}
                      >
                        {item.done ? 'Ready' : 'Needs review'}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selectedRow.publicHostname ? (
                    <a href={`https://${selectedRow.publicHostname}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <div className="btn secondary" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                        Open Public Site
                      </div>
                    </a>
                  ) : null}
                  {selectedRow.staffHostname ? (
                    <a href={`https://${selectedRow.staffHostname}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <div className="btn secondary" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                        Open Staff Site
                      </div>
                    </a>
                  ) : null}
                  <a href="/admin/settings" style={{ textDecoration: 'none' }}>
                    <div className="btn secondary" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                      Open Current Settings
                    </div>
                  </a>
                  <a href="/admin/users" style={{ textDecoration: 'none' }}>
                    <div className="btn secondary" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                      Open Staff Users
                    </div>
                  </a>
                </div>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing notes</span>
                <textarea
                  value={selectedRow.billingNotes || ''}
                  onChange={(e) => updateSelectedRow({ billingNotes: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', resize: 'vertical' }}
                  placeholder="Internal notes about onboarding, pricing, or follow-up."
                />
              </label>

              <div style={{ fontSize: 13, color: '#64748b' }}>
                {selectedRow.features.plan === 'basic'
                  ? 'Basic keeps the core deer-processing workflow only.'
                  : selectedRow.features.plan === 'texting'
                    ? 'Texting includes SMS notifications but no custom workflows.'
                    : selectedRow.features.webbsEnabled
                      ? 'Custom includes texting plus Webbs/custom workflow access.'
                      : 'Custom includes texting and can optionally turn on Webbs/custom workflows.'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Updated: {selectedRow.updatedAt ? formatDisplayDateTime(selectedRow.updatedAt) : 'Never'}
                </div>
                <button className="btn" type="button" onClick={() => void saveRow(selectedRow)} disabled={savingId === selectedRow.id}>
                  {savingId === selectedRow.id ? 'Saving...' : 'Save Processor'}
                </button>
              </div>
            </section>
          </div>
        )}
      </>
      )}
    </main>
  );
}
