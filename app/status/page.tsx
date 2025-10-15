'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SITE, phoneHref } from '@/lib/config';

/**
 * Public status lookup
 * - Search by Confirmation #, or Tag + Last Name
 * - Shows customer info, overall (meat) status, per-track statuses (Cape/Webbs/Specialty)
 * - Prices + paid flags
 * - Clear pickup panel with Google Maps + tap-to-call
 */

type LookupResult = {
  ok?: boolean;
  notFound?: boolean;
  error?: string;

  // identity
  tag?: string;
  confirmation?: string;
  customer?: string;

  // statuses
  status?: string; // overall/meat
  tracks?: {
    webbsStatus?: string;
    capeStatus?: string;
    specialtyStatus?: string;
  };

  // pricing
  priceProcessing?: number;
  priceSpecialty?: number;
  priceTotal?: number;

  // paid flags
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
};

export default function StatusPage() {
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');
  const [res, setRes] = useState<LookupResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch('/api/public-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, tag, lastName }),
      });
      const j = (await r.json()) as LookupResult;
      if (!j.ok) {
        setErr(j.error || (j.notFound ? 'No match.' : 'Not found.'));
      } else {
        setRes(j);
      }
    } catch (e: any) {
      setErr(e?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  const READY_WORDS = ['ready', 'finished', 'complete', 'completed', 'done'];
  const textHas = (s?: string) => String(s || '').toLowerCase();

  // normalize specialty so it shows whether it comes back at top-level or inside tracks
  const specialtyStatus =
    (res?.tracks?.specialtyStatus ??
      (res as any)?.specialtyStatus ??
      undefined);

  const isReady = (() => {
    if (!res) return false;
    const t = res.tracks || {};
    return (
      READY_WORDS.some((w) => textHas(res.status).includes(w)) ||
      READY_WORDS.some((w) => textHas(t.capeStatus).includes(w)) ||
      READY_WORDS.some((w) => textHas(t.webbsStatus).includes(w)) ||
      READY_WORDS.some((w) => textHas(specialtyStatus).includes(w))
    );
  })();

  const mapsUrl = SITE.mapsUrl; // built centrally from env: explicit → lat/lng → address

  return (
    <main style={{ maxWidth: 780, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        Check Status
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Use your <b>Confirmation #</b>, or <b>Tag + Last Name</b>.
      </p>

      <form onSubmit={lookup} style={{ display: 'grid', gap: 12 }}>
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Confirmation #"
          inputMode="numeric"
          style={field}
          aria-label="Confirmation number"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag"
            style={field}
            aria-label="Tag number"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last Name"
            style={field}
            aria-label="Customer last name"
          />
        </div>
        <button disabled={loading} style={btn} aria-busy={loading}>
          {loading ? 'Checking…' : 'Check status'}
        </button>
      </form>

      {err ? (
        <div role="alert" style={errBox}>
          {err}
        </div>
      ) : null}

      {res ? (
        <div style={card}>
          {/* Customer + identifiers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Info label="Customer" value={res.customer || '—'} />
            <Info label="Confirmation" value={res.confirmation || '—'} />
            <Info label="Tag" value={res.tag || '—'} />
            <Info label="Overall Status (Meat)" value={res.status || '—'} />
          </div>

          {/* Per-track statuses (no duplicate Meat) */}
          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
            {res.tracks?.capeStatus ? (
              <Track label="Cape" value={res.tracks.capeStatus} />
            ) : null}
            {res.tracks?.webbsStatus ? (
              <Track label="Webbs" value={res.tracks.webbsStatus} />
            ) : null}
            {specialtyStatus ? (
              <Track label="Specialty" value={specialtyStatus} />
            ) : null}
          </div>

          {/* Pricing + Paid */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px dashed #1f2937',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <Info
              label="Processing Price"
              value={money(res.priceProcessing)}
            />
            <Info
              label="Specialty Price"
              value={money(res.priceSpecialty)}
            />
            <Info label="Total" value={money(res.priceTotal)} />
            <div>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                Paid
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={pillSmall(res.paidProcessing)}>
                  Processing: {res.paidProcessing ? 'Yes' : 'No'}
                </span>
                <span style={pillSmall(res.paidSpecialty)}>
                  Specialty: {res.paidSpecialty ? 'Yes' : 'No'}
                </span>
                <span style={pillSmall(res.paid)}>
                  In Full: {res.paid ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Pickup panel (directions, hours, phone) */}
          <PickupPanel
            ready={isReady}
            addressText={SITE.address}
            mapsUrl={mapsUrl}
            phoneHref={phoneHref}
            phoneDisplay={SITE.phone}
            hours={SITE.hours} // accepts ReadonlyArray
          />
        </div>
      ) : null}

      <div style={{ marginTop: 18, opacity: 0.8, fontSize: 13 }}>
        Tip: Don’t see your order? Try a different query (Confirmation # is
        best), or{' '}
        <Link
          href="/faq-public"
          style={{ color: '#a7e3ba', textDecoration: 'underline' }}
        >
          check the FAQ
        </Link>
        .
      </div>
    </main>
  );
}

/* ---------- small presentational bits ---------- */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={valueBox}>{value}</div>
    </div>
  );
}

function Track({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <b style={{ opacity: 0.85 }}>{label}:</b>{' '}
      <span style={pill}>{value}</span>
    </div>
  );
}

function PickupPanel({
  ready,
  addressText,
  mapsUrl,
  phoneHref,
  phoneDisplay,
  hours,
}: {
  ready: boolean;
  addressText: string;
  mapsUrl: string;
  phoneHref: string;
  phoneDisplay: string;
  // Readonly so SITE.hours can be passed directly
  hours: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <section
      aria-label="Pickup Information"
      style={{
        marginTop: 12,
        border: '1px solid #1f2937',
        background: '#0b0f12',
        borderRadius: 12,
        padding: 12,
        color: '#e6e7eb',
        display: 'grid',
        gap: 10,
      }}
    >
      {ready && (
        <div
          style={{
            background: '#193b2e',
            border: '1px solid #2a5f47',
            color: '#a7e3ba',
            borderRadius: 10,
            padding: '8px 10px',
            fontWeight: 800,
          }}
        >
          Ready for pickup
        </div>
      )}

      <div>
        <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>
          Pickup Location
        </div>
        <div style={{ opacity: 0.9 }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#a7e3ba', textDecoration: 'underline' }}
          >
            {addressText}
          </a>
        </div>
      </div>

      {hours?.length ? (
        <div>
          <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>
            Hours
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.9 }}>
            {hours.map((h, i) => (
              <li key={i}>
                {h.label} {h.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={btn}>
          Open in Google Maps
        </a>
        <a href={phoneHref} style={btnGhost}>
          Call {phoneDisplay}
        </a>
      </div>

      <div style={{ fontSize: 12, color: 'rgba(230,235,232,.75)' }}>
        Need after-hours pickup? Call and we’ll work with you.
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */

function money(n?: number) {
  if (n == null || isNaN(n)) return '—';
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

/* ---------- styles ---------- */

const field: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #1f2937',
  borderRadius: 10,
  background: '#0b0f12',
  color: '#e5e7eb',
};

const valueBox: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #1f2937',
  borderRadius: 10,
  background: '#0b0f12',
  color: '#e5e7eb',
  fontWeight: 800,
};

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 12px',
  border: '1px solid #1f2937',
  borderRadius: 10,
  background: '#121821',
  color: '#e5e7eb',
  fontWeight: 800,
  textDecoration: 'none',
};

const btnGhost: React.CSSProperties = {
  ...btn,
  background: 'transparent',
};

const card: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  border: '1px solid #1f2937',
  borderRadius: 12,
  background: '#0b0f12',
  color: '#e5e7eb',
};

const errBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: '1px solid #7f1d1d',
  borderRadius: 10,
  background: 'rgba(127,29,29,.15)',
  color: '#fecaca',
};

const pill: React.CSSProperties = {
  display: 'inline-block',
  border: '1px solid #1f2937',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#0b0f12',
  fontWeight: 900,
};

function pillSmall(on?: boolean): React.CSSProperties {
  return {
    ...pill,
    padding: '2px 8px',
    fontSize: 12,
    background: on ? '#0f1d14' : '#1a0f0f',
    borderColor: on ? '#1f3b2c' : '#3b1f1f',
  };
}
