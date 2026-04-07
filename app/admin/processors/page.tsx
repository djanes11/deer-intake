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
  billingStatus: 'setup' | 'trial' | 'active' | 'past_due' | 'paused' | 'internal';
  billingCycle: 'monthly' | 'seasonal' | 'annual' | 'custom';
  monthlyPrice: number | null;
  trialEndsAt?: string | null;
  subscriptionStartedAt?: string | null;
  goLiveAt?: string | null;
  setupCompletedAt?: string | null;
  billingNotes?: string;
  updatedAt?: string | null;
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

export default function AdminProcessorsPage() {
  const [rows, setRows] = useState<ProcessorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
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
    setCreateForm((prev) => ({ ...prev, features: normalizedFeaturesForPlan({ ...prev.features, ...patch }) }));

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

      {createdSummary ? (
        <section
          style={{
            border: '1px solid #c7e7d0',
            borderRadius: 18,
            padding: 18,
            background: 'linear-gradient(180deg, #f4fbf6 0%, #ffffff 100%)',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
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
            Keep pricing light for now if you want. The main value here is tracking where a processor is in setup, trial, and go-live.
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
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing cycle</span>
            <select
              value={createForm.billingCycle}
              onChange={(e) => updateCreateForm({ billingCycle: e.target.value as ProcessorRow['billingCycle'] })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
            >
              <option value="monthly">Monthly</option>
              <option value="seasonal">Seasonal</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>Monthly price</span>
            <input
              value={createForm.monthlyPrice}
              onChange={(e) => updateCreateForm({ monthlyPrice: e.target.value })}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              placeholder="199"
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
                  <input type="checkbox" checked={row.features.smsEnabled} onChange={(e) => updateFeatures(row.id, { smsEnabled: e.target.checked })} disabled />
                  SMS enabled
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, color: '#0f172a' }}>
                  <input type="checkbox" checked={row.features.webbsEnabled} onChange={(e) => updateFeatures(row.id, { webbsEnabled: e.target.checked })} disabled={row.features.plan !== 'custom'} />
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
                      background: lifecycleTone(row.billingStatus).bg,
                      color: lifecycleTone(row.billingStatus).fg,
                      textTransform: 'capitalize',
                    }}
                  >
                    {row.billingStatus.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.55 }}>
                  Setup complete: {row.setupCompletedAt ? new Date(row.setupCompletedAt).toLocaleDateString() : 'Not marked yet'}.
                  {row.billingStatus === 'trial' && row.trialEndsAt ? ` Trial ends ${new Date(row.trialEndsAt).toLocaleDateString()}.` : ''}
                  {row.goLiveAt ? ` Go live ${new Date(row.goLiveAt).toLocaleDateString()}.` : ''}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing status</span>
                  <select value={row.billingStatus} onChange={(e) => updateRow(row.id, { billingStatus: e.target.value as ProcessorRow['billingStatus'] })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>
                    <option value="setup">Setup</option>
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="paused">Paused</option>
                    <option value="internal">Internal</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing cycle</span>
                  <select value={row.billingCycle} onChange={(e) => updateRow(row.id, { billingCycle: e.target.value as ProcessorRow['billingCycle'] })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>
                    <option value="monthly">Monthly</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Monthly price</span>
                  <input value={row.monthlyPrice ?? ''} onChange={(e) => updateRow(row.id, { monthlyPrice: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} placeholder="199" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Setup completed</span>
                  <input type="date" value={dateInputValue(row.setupCompletedAt)} onChange={(e) => updateRow(row.id, { setupCompletedAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Trial ends</span>
                  <input type="date" value={dateInputValue(row.trialEndsAt)} onChange={(e) => updateRow(row.id, { trialEndsAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Go live</span>
                  <input type="date" value={dateInputValue(row.goLiveAt)} onChange={(e) => updateRow(row.id, { goLiveAt: e.target.value || null })} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn secondary" type="button" onClick={() => updateRow(row.id, { setupCompletedAt: dateInputValue(new Date().toISOString()) })}>
                  Mark Setup Complete
                </button>
                <button className="btn secondary" type="button" onClick={() => updateRow(row.id, { goLiveAt: dateInputValue(new Date().toISOString()) })}>
                  Mark Go Live
                </button>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Billing notes</span>
                <textarea
                  value={row.billingNotes || ''}
                  onChange={(e) => updateRow(row.id, { billingNotes: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', resize: 'vertical' }}
                  placeholder="Internal notes about onboarding, pricing, or follow-up."
                />
              </label>

              <div style={{ fontSize: 13, color: '#64748b' }}>
                {row.features.plan === 'basic'
                  ? 'Basic keeps the core deer-processing workflow only.'
                  : row.features.plan === 'texting'
                    ? 'Texting includes SMS notifications but no custom workflows.'
                    : row.features.webbsEnabled
                      ? 'Custom includes texting plus Webbs/custom workflow access.'
                      : 'Custom includes texting and can optionally turn on Webbs/custom workflows.'}
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
