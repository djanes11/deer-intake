'use client';

import { FormEvent, useState } from 'react';

type FormState = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  state: string;
  annualVolume: string;
  currentWorkflow: string;
  message: string;
};

const EMPTY_FORM: FormState = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  state: '',
  annualVolume: '',
  currentWorkflow: '',
  message: '',
};

export default function ProcessorInquiryForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/public/processor-interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
      setMessage('Thanks. We received your request and can use it to prepare your demo or onboarding conversation.');
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 14,
    border: '1px solid #d5c4a7',
    background: 'rgba(255,255,255,.96)',
    color: '#0f172a',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,.04)',
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Processor name</span>
          <input value={form.businessName} onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))} required style={inputStyle} placeholder="Example Deer Processing" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Contact name</span>
          <input value={form.contactName} onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))} required style={inputStyle} placeholder="Owner or manager" />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required style={inputStyle} placeholder="name@processor.com" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Phone</span>
          <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} style={inputStyle} placeholder="Best call or text number" />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>State</span>
          <input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} style={inputStyle} placeholder="State" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>Approx. annual deer volume</span>
          <input value={form.annualVolume} onChange={(e) => setForm((prev) => ({ ...prev, annualVolume: e.target.value }))} style={inputStyle} placeholder="200-400 deer" />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 800, color: '#0f172a' }}>Current workflow</span>
        <input value={form.currentWorkflow} onChange={(e) => setForm((prev) => ({ ...prev, currentWorkflow: e.target.value }))} style={inputStyle} placeholder="Paper forms, Google Sheets, text messages, etc." />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 800, color: '#0f172a' }}>What should we know?</span>
        <textarea
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          placeholder="Tell us about after-hours drop-off, specialty products, labels, scan workflow, custom pricing, or anything unique about your shop."
        />
      </label>

      {message ? (
        <div style={{ color: '#166534', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
          {error}
        </div>
      ) : null}

      <button
        className="btn"
        type="submit"
        disabled={busy}
        style={{ width: '100%', justifyContent: 'center', padding: '14px 16px', borderRadius: 14, fontSize: 16, fontWeight: 900 }}
      >
        {busy ? 'Sending...' : 'Request Demo / Onboarding'}
      </button>
    </form>
  );
}
