'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ProcessorPreset = 'phone' | 'counter' | 'scanner';

type ProcessorFeatures = {
  plan: 'basic' | 'texting' | 'custom';
  smsEnabled: boolean;
  webbsEnabled: boolean;
};

type WizardForm = {
  name: string;
  slug: string;
  publicName: string;
  publicHostname: string;
  staffHostname: string;
  firstAdminEmail: string;
  firstAdminPassword: string;
  billingStatus: 'setup' | 'trial' | 'active' | 'past_due' | 'paused' | 'internal';
  billingCycle: 'monthly' | 'seasonal' | 'annual' | 'custom';
  setupFee: string;
  perDeerRate: string;
  preset: ProcessorPreset;
  features: ProcessorFeatures;
};

type CreatedSummary = {
  id: string;
  slug: string;
  publicName: string;
  publicHostname: string;
  staffHostname: string;
  firstAdminEmail: string;
};

const PRESET_COPY: Record<ProcessorPreset, { label: string; description: string; features: ProcessorFeatures; perDeerRate: string; checklist: string[] }> = {
  phone: {
    label: 'Phone-First Shop',
    description: 'Best for smaller deer processors that mostly work from phones and need a simple launch path.',
    features: { plan: 'basic', smsEnabled: false, webbsEnabled: false },
    perDeerRate: '2',
    checklist: [
      'Keep the first week focused on intake, search, and status lookups.',
      'Train one owner/admin first, then add simple local staff logins.',
      'Use printed intake sheets as the fallback while staff learn the flow.',
    ],
  },
  counter: {
    label: 'Front Counter + Desktop',
    description: 'For shops that run intake and pickup from one or two front-counter workstations.',
    features: { plan: 'texting', smsEnabled: true, webbsEnabled: false },
    perDeerRate: '3',
    checklist: [
      'Test search and pickup flow on both desktop and mobile.',
      'Turn on texting so customers use status updates instead of calling.',
      'Run one live deer all the way from intake to pickup before launch.',
    ],
  },
  scanner: {
    label: 'Scanner + Label Shop',
    description: 'For busier processors that want labels, scanning, and stronger production-floor workflow.',
    features: { plan: 'custom', smsEnabled: true, webbsEnabled: true },
    perDeerRate: '5',
    checklist: [
      'Verify public, staff, and scan workflows before opening season traffic.',
      'Test each print path: intake sheet, deer label, cape label, and package label.',
      'Decide who owns scan and pickup handoff during the busiest days of season.',
    ],
  },
};

const EMPTY_FORM: WizardForm = {
  name: '',
  slug: '',
  publicName: '',
  publicHostname: '',
  staffHostname: '',
  firstAdminEmail: '',
  firstAdminPassword: '',
  billingStatus: 'setup',
  billingCycle: 'monthly',
  setupFee: '',
  perDeerRate: PRESET_COPY.phone.perDeerRate,
  preset: 'phone',
  features: PRESET_COPY.phone.features,
};

const ONBOARDING_DRAFT_KEY = 'processor-onboarding-wizard-draft-v1';

function slugify(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function hostnameFor(slug: string, subdomain: string) {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return '';
  return `${cleanSlug}.${subdomain}`;
}

export default function ProcessorOnboardingWizardPage() {
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState<CreatedSummary | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const preset = PRESET_COPY[form.preset];
  const stepTitles = ['Shop Setup', 'Workflow Fit', 'Owner Access', 'Go Live'];

  const missing = useMemo(() => {
    const problems: string[] = [];
    if (!form.name.trim()) problems.push('Business name');
    if (!form.slug.trim()) problems.push('Slug');
    if (!form.publicHostname.trim()) problems.push('Public hostname');
    if (!form.staffHostname.trim()) problems.push('Staff hostname');
    if (!form.firstAdminEmail.trim()) problems.push('First admin email');
    if (form.firstAdminPassword.trim() && form.firstAdminPassword.trim().length < 8) problems.push('First admin password must be at least 8 characters');
    return problems;
  }, [form]);

  const updateForm = (patch: Partial<WizardForm>) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as { form?: WizardForm; step?: number } | null;
      if (parsed?.form) setForm({ ...EMPTY_FORM, ...parsed.form });
      if (typeof parsed?.step === 'number') setStep(Math.max(0, Math.min(stepTitles.length - 1, parsed.step)));
      setMessage('Restored the last onboarding draft saved on this device.');
    } catch {
      setMessage('Could not restore the saved onboarding draft. Starting fresh.');
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ form, step }));
  }, [draftReady, form, step]);

  const choosePreset = (nextPreset: ProcessorPreset) => {
    const next = PRESET_COPY[nextPreset];
    setForm((prev) => ({
      ...prev,
      preset: nextPreset,
      features: next.features,
      perDeerRate: !prev.perDeerRate || prev.perDeerRate === PRESET_COPY[prev.preset].perDeerRate ? next.perDeerRate : prev.perDeerRate,
    }));
  };

  const createProcessor = async () => {
    setBusy(true);
    setMessage('');
    try {
      const payload = {
        slug: slugify(form.slug),
        name: form.name.trim(),
        publicName: form.publicName.trim() || form.name.trim(),
        publicHostname: form.publicHostname.trim().toLowerCase(),
        staffHostname: form.staffHostname.trim().toLowerCase(),
        firstAdminEmail: form.firstAdminEmail.trim().toLowerCase(),
        firstAdminPassword: form.firstAdminPassword.trim(),
        features: form.features,
        billingStatus: form.billingStatus,
        billingCycle: form.billingCycle,
        setupFee: form.setupFee.trim(),
        perDeerRate: form.perDeerRate.trim(),
      };

      const res = await fetch('/api/admin/processors', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setCreated({
        id: String(json.row.id),
        slug: String(json.row.slug),
        publicName: String(json.row.publicName || json.row.name || payload.publicName),
        publicHostname: String(json.row.publicHostname || payload.publicHostname),
        staffHostname: String(json.row.staffHostname || payload.staffHostname),
        firstAdminEmail: payload.firstAdminEmail,
      });
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
      setMessage(`Created ${payload.publicName}. Default settings are seeded and ready for testing.`);
      setStep(3);
    } catch (e: any) {
      setMessage(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const resetDraft = () => {
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    setForm(EMPTY_FORM);
    setCreated(null);
    setStep(0);
    setMessage('Cleared the saved draft and reset the wizard.');
  };

  return (
    <main className="app-frame" style={{ maxWidth: 1160 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Platform Admin</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 38px)' }}>Processor Onboarding Wizard</h1>
            <div className="app-copy">
              Guide a new deer processor from setup through first-live testing without bouncing across three different admin pages.
            </div>
          </div>
          <div className="app-side-note">
            <div style={{ fontWeight: 900, color: '#fff7e8' }}>What this is for</div>
            <div style={{ color: 'rgba(245,236,216,.84)', lineHeight: 1.55 }}>
              Use this for the first setup pass. Detailed branding, pricing, and processor-facing wording can still be refined later in Public Site Settings.
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="app-surface-light" style={{ padding: 12, borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 800 }}>
          {message}
        </div>
      ) : null}

      <section className="app-surface-light" style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="app-section-title">Guided Setup</div>
            <div className="app-section-copy">Move one step at a time and keep the launch path simple.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" onClick={resetDraft}>
              Clear Draft
            </button>
            <Link href="/admin/processors" className="btn secondary" style={{ textDecoration: 'none' }}>
              Back to Processor Management
            </Link>
          </div>
        </div>

        <div className="wizardSteps">
          {stepTitles.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`wizardStep ${idx === step ? 'active' : ''} ${idx < step ? 'done' : ''}`}
              onClick={() => setStep(idx)}
            >
              <span>{idx + 1}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </div>

        <div className="wizardDraftBar">
          <div>
            <strong>Draft status:</strong> {draftReady ? 'Saved automatically on this device.' : 'Loading saved draft...'}
          </div>
          <div>
            <strong>Current step:</strong> {stepTitles[step]}
          </div>
        </div>

        <div className="wizardGrid">
          <section className="wizardMain">
            {step === 0 ? (
              <div className="wizardCard">
                <div className="wizardCardTitle">Shop Setup</div>
                <div className="wizardCardCopy">
                  Set the processor identity, slug, and hostnames first so the rest of the setup has a stable foundation.
                </div>
                <div className="wizardFormGrid">
                  <label className="wizardField">
                    <span>Business name</span>
                    <input
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const nextSlug = form.slug || slugify(name);
                        updateForm({
                          name,
                          publicName: form.publicName || name,
                          slug: nextSlug,
                          publicHostname: form.publicHostname || hostnameFor(nextSlug, 'deer.local'),
                          staffHostname: form.staffHostname || hostnameFor(nextSlug, 'staff.local'),
                        });
                      }}
                      placeholder="Smith Family Processing"
                    />
                  </label>
                  <label className="wizardField">
                    <span>Slug</span>
                    <input
                      value={form.slug}
                      onChange={(e) => {
                        const slug = slugify(e.target.value);
                        updateForm({
                          slug,
                          publicHostname: hostnameFor(slug, 'deer.local'),
                          staffHostname: hostnameFor(slug, 'staff.local'),
                        });
                      }}
                      placeholder="smith-family"
                    />
                  </label>
                  <label className="wizardField">
                    <span>Public name</span>
                    <input value={form.publicName} onChange={(e) => updateForm({ publicName: e.target.value })} placeholder="Smith Family Deer Processing" />
                  </label>
                  <label className="wizardField">
                    <span>Public hostname</span>
                    <input value={form.publicHostname} onChange={(e) => updateForm({ publicHostname: e.target.value })} placeholder="smith-family.deer.local" />
                  </label>
                  <label className="wizardField">
                    <span>Staff hostname</span>
                    <input value={form.staffHostname} onChange={(e) => updateForm({ staffHostname: e.target.value })} placeholder="smith-family.staff.local" />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="wizardCard">
                <div className="wizardCardTitle">Workflow Fit</div>
                <div className="wizardCardCopy">
                  Pick the starting template that matches how this processor actually works. We can fine-tune details later.
                </div>
                <div className="presetGrid">
                  {(Object.keys(PRESET_COPY) as ProcessorPreset[]).map((key) => {
                    const option = PRESET_COPY[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`presetCard ${form.preset === key ? 'active' : ''}`}
                        onClick={() => choosePreset(key)}
                      >
                        <div className="presetLabel">{option.label}</div>
                        <div className="presetCopy">{option.description}</div>
                        <div className="presetMeta">
                          Plan: {option.features.plan} | SMS {option.features.smsEnabled ? 'on' : 'off'} | Webbs {option.features.webbsEnabled ? 'on' : 'off'}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="wizardFormGrid">
                  <label className="wizardField">
                    <span>Billing lifecycle</span>
                    <select value={form.billingStatus} onChange={(e) => updateForm({ billingStatus: e.target.value as WizardForm['billingStatus'] })}>
                      <option value="setup">Setup</option>
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                    </select>
                  </label>
                  <label className="wizardField">
                    <span>Billing cycle</span>
                    <select value={form.billingCycle} onChange={(e) => updateForm({ billingCycle: e.target.value as WizardForm['billingCycle'] })}>
                      <option value="monthly">Monthly</option>
                      <option value="seasonal">Seasonal</option>
                      <option value="annual">Annual</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="wizardField">
                    <span>Setup fee</span>
                    <input value={form.setupFee} onChange={(e) => updateForm({ setupFee: e.target.value })} placeholder="Optional one-time fee" />
                  </label>
                  <label className="wizardField">
                    <span>Per deer rate</span>
                    <input value={form.perDeerRate} onChange={(e) => updateForm({ perDeerRate: e.target.value })} placeholder="2" />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="wizardCard">
                <div className="wizardCardTitle">Owner Access</div>
                <div className="wizardCardCopy">
                  Attach the first processor admin now so the shop can sign in immediately after creation.
                </div>
                <div className="wizardFormGrid">
                  <label className="wizardField">
                    <span>First admin email</span>
                    <input value={form.firstAdminEmail} onChange={(e) => updateForm({ firstAdminEmail: e.target.value })} placeholder="owner@processor.com" />
                  </label>
                  <label className="wizardField">
                    <span>Temporary password</span>
                    <input type="password" value={form.firstAdminPassword} onChange={(e) => updateForm({ firstAdminPassword: e.target.value })} placeholder="Optional but recommended" />
                  </label>
                </div>
                <div className="wizardNote">
                  Keep owners and managers on email-based logins so they can recover their own password. Seasonal and floor staff can be added later from Staff Team as local logins.
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="wizardCard">
                <div className="wizardCardTitle">Go Live</div>
                <div className="wizardCardCopy">
                  Use this checklist to make sure the processor is actually ready before the first real deer comes through.
                </div>
                <div className="goLiveGrid">
                  <div className="goLiveList">
                    {[
                      'Open the public intake form on a phone and submit one test deer.',
                      'Open Search and confirm the deer can be found by tag, name, and phone.',
                      'Open the intake record and confirm pricing defaults, labels, and notes flow correctly.',
                      'Test one staff sign-in on both desktop and mobile.',
                      'Run one pickup test so balance due and paid status are obvious.',
                    ].map((item) => (
                      <div key={item} className="goLiveItem">{item}</div>
                    ))}
                  </div>
                  <div className="goLiveLinks">
                    {created?.publicHostname ? (
                      <a href={`https://${created.publicHostname}`} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                        Open Public Site
                      </a>
                    ) : null}
                    {created?.staffHostname ? (
                      <a href={`https://${created.staffHostname}`} target="_blank" rel="noreferrer" className="btn secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                        Open Staff Site
                      </a>
                    ) : null}
                    <Link href="/admin/settings" className="btn secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                      Public Site Settings
                    </Link>
                    <Link href="/search" className="btn secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                      Test Search
                    </Link>
                    <Link href="/staff/team" className="btn secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                      Open Staff Team
                    </Link>
                    <Link href="/admin/users" className="btn secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                      Platform Users
                    </Link>
                  </div>
                </div>
                {created ? (
                  <div className="createdSummary">
                    <div className="createdTitle">{created.publicName}</div>
                    <div>Slug: {created.slug}</div>
                    <div>First admin: {created.firstAdminEmail || 'Not attached yet'}</div>
                    <div>Public host: {created.publicHostname || 'Not set'}</div>
                    <div>Staff host: {created.staffHostname || 'Not set'}</div>
                  </div>
                ) : (
                  <button type="button" className="btn" disabled={busy || missing.length > 0} onClick={() => void createProcessor()}>
                    {busy ? 'Creating...' : 'Create Processor And Seed Defaults'}
                  </button>
                )}
              </div>
            ) : null}

            <div className="wizardActions">
              <button type="button" className="btn secondary" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}>
                Back
              </button>
              {step < stepTitles.length - 1 ? (
                <button type="button" className="btn" onClick={() => setStep((prev) => Math.min(stepTitles.length - 1, prev + 1))}>
                  Continue
                </button>
              ) : null}
            </div>
          </section>

          <aside className="wizardSidebar">
            <div className="wizardSidebarCard">
              <div className="wizardSidebarKicker">Preset</div>
              <div className="wizardSidebarTitle">{preset.label}</div>
              <div className="wizardSidebarCopy">{preset.description}</div>
              <div className="wizardSidebarList">
                {preset.checklist.map((item) => (
                  <div key={item} className="wizardSidebarItem">{item}</div>
                ))}
              </div>
            </div>

            <div className="wizardSidebarCard">
              <div className="wizardSidebarKicker">Readiness</div>
              <div className="wizardSidebarTitle">{missing.length ? 'Still needs attention' : 'Ready to create'}</div>
              <div className="wizardSidebarList">
                {missing.length ? missing.map((item) => (
                  <div key={item} className="wizardSidebarItem warn">{item}</div>
                )) : (
                  <div className="wizardSidebarItem ok">Core creation fields are filled out.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <style jsx>{`
        .wizardSteps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .wizardStep {
          border: 1px solid #d6dee8;
          background: #fff;
          color: #334155;
          border-radius: 14px;
          padding: 12px;
          display: grid;
          gap: 6px;
          text-align: left;
          cursor: pointer;
        }
        .wizardStep span {
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
        }
        .wizardStep.active {
          border-color: #c88a3d;
          background: #fff7eb;
          color: #7c4b17;
        }
        .wizardStep.done {
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        .wizardGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
          gap: 16px;
        }
        .wizardDraftBar {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding: 12px 14px;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          background: #f8fafc;
          color: #475569;
        }
        .wizardMain {
          display: grid;
          gap: 14px;
        }
        .wizardCard,
        .wizardSidebarCard {
          border: 1px solid #d6dee8;
          border-radius: 18px;
          background: #fff;
          padding: 18px;
          display: grid;
          gap: 12px;
        }
        .wizardCardTitle,
        .wizardSidebarTitle {
          font-size: 24px;
          font-weight: 950;
          color: #0f172a;
          line-height: 1.1;
        }
        .wizardCardCopy,
        .wizardSidebarCopy {
          color: #475569;
          line-height: 1.55;
        }
        .wizardFormGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .wizardField {
          display: grid;
          gap: 6px;
        }
        .wizardField span {
          font-weight: 800;
          color: #0f172a;
        }
        .wizardField input,
        .wizardField select {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #0f172a;
        }
        .presetGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .presetCard {
          border: 1px solid #d6dee8;
          border-radius: 16px;
          background: #fff;
          padding: 14px;
          display: grid;
          gap: 8px;
          text-align: left;
          cursor: pointer;
        }
        .presetCard.active {
          border-color: #c88a3d;
          background: #fff7eb;
          box-shadow: 0 10px 22px rgba(200, 138, 61, 0.14);
        }
        .presetLabel {
          font-weight: 900;
          color: #0f172a;
        }
        .presetCopy,
        .presetMeta,
        .wizardNote,
        .goLiveItem,
        .wizardSidebarItem {
          color: #475569;
          line-height: 1.5;
        }
        .wizardNote {
          padding: 12px 14px;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          background: #f8fafc;
        }
        .goLiveGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
          gap: 16px;
        }
        .goLiveList,
        .goLiveLinks,
        .wizardSidebarList {
          display: grid;
          gap: 10px;
        }
        .goLiveItem,
        .wizardSidebarItem {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #dbe4ee;
          background: #f8fafc;
        }
        .wizardSidebarItem.warn {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #9a3412;
        }
        .wizardSidebarItem.ok {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }
        .wizardSidebarKicker {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #64748b;
        }
        .createdSummary {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          border-radius: 14px;
          padding: 14px;
          display: grid;
          gap: 6px;
          color: #166534;
        }
        .createdTitle {
          font-size: 18px;
          font-weight: 900;
        }
        .wizardActions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wizardSidebar {
          display: grid;
          gap: 14px;
          align-content: start;
        }
        @media (max-width: 900px) {
          .wizardSteps,
          .wizardGrid,
          .goLiveGrid {
            grid-template-columns: 1fr;
          }
          .wizardDraftBar {
            display: grid;
          }
        }
      `}</style>
    </main>
  );
}

