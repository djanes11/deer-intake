'use client';

import { useEffect, useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';
import { DEFAULT_SITE_PRICING, SitePricing, formatMoney, normalizePricing } from '@/lib/pricing';

type HourRow = {
  label: string;
  value: string;
};

type BrandingSettings = {
  name: string;
  locationLabel: string;
  tagline: string;
  logoUrl: string;
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  address: string;
  mapsUrl: string;
};

type SiteSettings = {
  public_intake_enabled: boolean;
  banner_enabled: boolean;
  banner_message: string;
  hours: HourRow[];
  pricing: SitePricing;
  branding: BrandingSettings;
  updated_at?: string;
};

const DEFAULT_HOURS: HourRow[] = [
  { label: 'Mon-Fri', value: '6-8 pm' },
  { label: 'Sat', value: '9-5' },
  { label: 'Sun', value: '9-12' },
  { label: 'After Hours', value: 'Overnight drop available' },
];

const DEFAULT_BRANDING: BrandingSettings = {
  name: 'McAfee Custom Deer Processing',
  locationLabel: 'Palmyra, IN',
  tagline: 'Fast, clean, professional deer processing.',
  logoUrl: '/mcafee-logo.png',
  phoneDisplay: '(502) 643-3916',
  phoneE164: '+15026433916',
  email: '',
  address: '10977 Buffalo Trace Rd, Palmyra, IN 47164',
  mapsUrl: '',
};

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
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('McAfee Deer Processing test SMS. If you got this, Twilio is wired correctly.');
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  const [smsHealthBusy, setSmsHealthBusy] = useState(false);
  const [smsHealthMsg, setSmsHealthMsg] = useState('');

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
      pricing: normalizePricing(j?.settings),
      branding: {
        ...DEFAULT_BRANDING,
        ...(j?.settings?.branding || {}),
      },
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
        ...normalizePricing(s.pricing),
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
        pricing: normalizePricing(j?.settings),
        branding: {
          ...DEFAULT_BRANDING,
          ...(j?.settings?.branding || {}),
        },
      });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 1500);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const updatePricing = (key: keyof SitePricing, value: string) => {
    if (!s) return;
    setS({
      ...s,
      pricing: {
        ...normalizePricing(s.pricing),
        [key]: value,
      } as SitePricing,
    });
  };

  const updateHour = (index: number, key: keyof HourRow, value: string) => {
    if (!s) return;
    const nextHours = normalizeHours(s.hours).map((row, i) => (i === index ? { ...row, [key]: value } : row));
    setS({ ...s, hours: nextHours });
  };

  const sendTestSms = async () => {
    setSmsBusy(true);
    setSmsMsg('');
    try {
      const res = await fetch('/api/admin/test-sms', {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: smsTo, message: smsBody }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const status = j?.status ? ` (${j.status})` : '';
      setSmsMsg(`SMS sent to ${j.to}${status}`);
    } catch (e: any) {
      setSmsMsg(String(e?.message || e));
    } finally {
      setSmsBusy(false);
    }
  };

  const checkSmsHealth = async () => {
    setSmsHealthBusy(true);
    setSmsHealthMsg('');
    try {
      const res = await fetch('/api/admin/twilio-health', { headers, cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        const status = j?.twilioAccountStatus ? `Twilio account status: ${j.twilioAccountStatus}. ` : '';
        const enabled = j?.enabled ? 'SMS enabled. ' : 'SMS disabled. ';
        const allowlist = Array.isArray(j?.allowlist) && j.allowlist.length
          ? `Allowlist restricted to: ${j.allowlist.join(', ')}`
          : 'Allowlist: unrestricted (all numbers can be sent texts)';
        setSmsHealthMsg(`${status}${enabled}${allowlist}`);
      } else {
        const code = j?.code ? ` (${j.code})` : '';
        setSmsHealthMsg(`${j?.error || `HTTP ${res.status}`}${code}`);
      }
    } catch (e: any) {
      setSmsHealthMsg(String(e?.message || e));
    } finally {
      setSmsHealthBusy(false);
    }
  };

  if (!s) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: '24px auto',
          padding: 16,
          color: '#0f172a',
          background: '#f8fafc',
          border: '1px solid #dbe4ee',
          borderRadius: 16,
        }}
      >
        Loading... {msg ? <div style={{ marginTop: 8, color: '#991b1b', fontWeight: 700 }}>{msg}</div> : null}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '24px auto',
        padding: 16,
        color: '#0f172a',
      }}
    >
      <div
        style={{
          marginBottom: 16,
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #122217 0%, #22412d 100%)',
          color: '#f8fafc',
          border: '1px solid #2f6f3f',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#b9ddc2' }}>
          Staff Controls
        </div>
        <h2 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05, color: '#ffffff' }}>Public Site Settings</h2>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 700, lineHeight: 1.5 }}>
          Update the public intake status, banner message, and customer-facing pickup hours from one place.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Brand & Contact</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These details show up on the public site for this processor. Plan tiers and feature access now live on the processor management page.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              ['Business name', 'name'],
              ['Location label', 'locationLabel'],
              ['Public tagline', 'tagline'],
              ['Logo URL', 'logoUrl'],
              ['Phone display', 'phoneDisplay'],
              ['Phone E.164', 'phoneE164'],
              ['Support email', 'email'],
              ['Address', 'address'],
              ['Google Maps URL', 'mapsUrl'],
            ].map(([label, key]) => (
              <label key={key} style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{label}</span>
                <input
                  value={(s.branding as any)?.[key] || ''}
                  onChange={(e) =>
                    setS({
                      ...s,
                      branding: {
                        ...DEFAULT_BRANDING,
                        ...s.branding,
                        [key]: e.target.value,
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Public Intake</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={!!s.public_intake_enabled}
              onChange={(e) => setS({ ...s, public_intake_enabled: e.target.checked })}
            />
            Public intake enabled
          </label>
          <div
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: s.public_intake_enabled ? '#ecfdf5' : '#fff7ed',
              color: s.public_intake_enabled ? '#166534' : '#9a3412',
              border: `1px solid ${s.public_intake_enabled ? '#bbf7d0' : '#fed7aa'}`,
            }}
          >
            {s.public_intake_enabled ? 'Public intake is live' : 'Public intake is off'}
          </div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Turn this off when you are at capacity or temporarily closed. The public pages will show the intake as unavailable.
          </div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Need to change plan tier, SMS access, Webbs access, or hostnames? Use <a href="/admin/processors" style={{ color: '#1d4ed8', fontWeight: 800 }}>Processor Management</a>.
          </div>
        </div>

        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Banner</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={!!s.banner_enabled}
              onChange={(e) => setS({ ...s, banner_enabled: e.target.checked })}
            />
            Show public banner
          </label>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 6, color: '#0f172a' }}>Banner message</div>
            <textarea
              rows={3}
              value={s.banner_message || ''}
              onChange={(e) => setS({ ...s, banner_message: e.target.value })}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
              }}
              placeholder="Example: We are currently full and not accepting public intake submissions."
            />
          </div>

          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 14,
              background: s.banner_enabled ? '#fff7ed' : '#f8fafc',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: '#475569', marginBottom: 6 }}>Banner Preview</div>
            <div
              style={{
                borderRadius: 10,
                padding: '10px 12px',
                background: s.banner_enabled ? '#7c2d12' : '#e2e8f0',
                color: s.banner_enabled ? '#fff7ed' : '#475569',
                fontWeight: 800,
                lineHeight: 1.45,
              }}
            >
              {s.banner_enabled
                ? s.banner_message?.trim() || 'Your banner message will appear here.'
                : 'Banner is currently hidden on the public site.'}
            </div>
          </div>
        </div>

        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Pickup Hours</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These rows show on the public Hours page and any public page that uses the public hours feed.
          </div>

          {normalizeHours(s.hours).map((row, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1fr) minmax(0, 2fr)',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <input
                value={row.label}
                onChange={(e) => updateHour(idx, 'label', e.target.value)}
                placeholder="Label"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <input
                value={row.value}
                onChange={(e) => updateHour(idx, 'value', e.target.value)}
                placeholder="Hours"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setS({ ...s, hours: [...normalizeHours(s.hours), { label: '', value: '' }] })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
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
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Defaults
            </button>
          </div>
        </div>

        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>Pricing</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            These values drive the intake totals, specialty totals, print sheet pricing, and customer-facing pricing copy.
          </div>

          {[
            ['standard_processing_price', 'Standard Processing'],
            ['caped_price', 'Caped'],
            ['cape_donate_price', 'Cape & Donate'],
            ['beef_fat_add_on', 'Beef Fat Add-On'],
            ['webbs_add_on', 'Webbs Add-On'],
            ['summer_sausage_price_per_lb', 'Summer Sausage Price / lb'],
            ['snack_stix_price_per_lb', 'Snack Stix Price / lb'],
          ].map(([key, label]) => (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.5fr) minmax(120px, 0.7fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: 10,
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{label}</div>
              <input
                inputMode="decimal"
                value={String((s.pricing as any)?.[key] ?? '')}
                onChange={(e) => updatePricing(key as keyof SitePricing, e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', minWidth: 72 }}>
                {formatMoney(Number((s.pricing as any)?.[key] ?? 0))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setS({ ...s, pricing: DEFAULT_SITE_PRICING })}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reset Pricing Defaults
            </button>
          </div>
        </div>

        <div
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
          <div style={{ fontWeight: 900, fontSize: 20, color: '#0f172a' }}>SMS Testing</div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            This is a staff-only Twilio test tool. It still respects your SMS env guard and allowlist, so it is safe to
            wire before turning live texting on.
          </div>
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            If <code>TWILIO_SMS_ALLOWLIST</code> is blank, texting is unrestricted and can go to any valid number.
            Keep <code>TWILIO_SMS_ENABLED</code> as your main on/off switch.
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: '#0f172a' }}>Test phone number</div>
              <input
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+15024092686"
                style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', width: '100%' }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: '#0f172a' }}>Test message</div>
              <textarea
                rows={3}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                style={{ padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={checkSmsHealth}
              disabled={smsHealthBusy}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 800,
                cursor: smsHealthBusy ? 'wait' : 'pointer',
              }}
            >
              {smsHealthBusy ? 'Checking...' : 'Check Twilio Health'}
            </button>
            <button
              type="button"
              onClick={sendTestSms}
              disabled={smsBusy}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #235532',
                background: smsBusy ? '#94a3b8' : '#2f6f3f',
                color: '#fff',
                fontWeight: 800,
                cursor: smsBusy ? 'wait' : 'pointer',
              }}
            >
              {smsBusy ? 'Sending...' : 'Send Test SMS'}
            </button>
            {smsMsg ? (
              <div style={{ fontSize: 13, fontWeight: 900, color: smsMsg.toLowerCase().includes('sent') ? '#166534' : '#991b1b' }}>
                {smsMsg}
              </div>
            ) : null}
            {smsHealthMsg ? (
              <div style={{ fontSize: 13, fontWeight: 800, color: smsHealthMsg.toLowerCase().includes('status:') ? '#166534' : '#991b1b' }}>
                {smsHealthMsg}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '8px 4px 0',
          }}
        >
          <button
            onClick={save}
            disabled={busy}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #235532',
              background: '#2f6f3f',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: msg === 'Saved' ? '#166534' : '#334155',
            }}
          >
            {msg}
          </div>
        </div>
      </div>
    </div>
  );
}
