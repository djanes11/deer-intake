'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { tokenHeader } from '@/lib/api';

export default function HealthPage() {
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('Wild Game Butcher Board test SMS. If you got this, Twilio is wired correctly.');
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
    <main style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
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
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Admin Health</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 760, lineHeight: 1.5 }}>
          Platform-level tools for checking Twilio status and sending a safe test SMS without mixing those controls into processor-owned settings.
        </div>
      </div>

      <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #d6dee8', color: '#475569', lineHeight: 1.5 }}>
        These tools are for platform admins. Processor-facing settings stay focused on business info, intake, hours, banners, and pricing.
      </div>

      <section style={panel}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Twilio Health</div>
        <div style={{ color: '#334155', lineHeight: 1.55 }}>
          Check whether SMS is enabled and whether the current environment is restricted by an allowlist.
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
          {smsHealthMsg ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: smsHealthMsg.toLowerCase().includes('status:') ? '#166534' : '#991b1b' }}>
              {smsHealthMsg}
            </div>
          ) : null}
        </div>
      </section>

      <section style={panel}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Send Test SMS</div>
        <div style={{ color: '#334155', lineHeight: 1.55 }}>
          This respects your current Twilio environment guard and allowlist, so it is safe to use while validating SMS setup.
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
        </div>
      </section>
    </main>
  );
}
