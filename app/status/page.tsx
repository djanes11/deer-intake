// app/status/page.tsx
'use client';

import { useState } from 'react';
import { SITE } from '@/lib/config';
import Link from 'next/link';

/**
 * Search by:
 *  - Confirmation #
 *  - Tag + Last Name
 *
 * Renders:
 *  - Core status + extra tracks (Webbs / Specialty / Cape) when present
 *  - Pickup panel with address, hours, Call, and Google Maps
 */

type LookupResult = {
  ok?: boolean;
  notFound?: boolean;
  error?: string;
  tag?: string;
  confirmation?: string;
  status?: string;
  tracks?: {
    webbsStatus?: string;
    specialtyStatus?: string;
    capeStatus?: string;
  };
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
    setLoading(true); setErr(null); setRes(null);
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

  const isReady = (() => {
    if (!res) return false;
    const t = res.tracks || {};
    return (
      READY_WORDS.some(w => textHas(res.status).includes(w)) ||
      READY_WORDS.some(w => textHas(t.capeStatus).includes(w)) ||
      READY_WORDS.some(w => textHas(t.webbsStatus).includes(w)) ||
      READY_WORDS.some(w => textHas(t.specialtyStatus).includes(w))
    );
  })();

  const phoneHref = `tel:${(SITE.phone || '').replace(/\D+/g, '')}`;
const mapsUrl =
  SITE.mapsUrl && SITE.mapsUrl.trim().length > 0
    ? SITE.mapsUrl
    : Number.isFinite(SITE.lat) && Number.isFinite(SITE.lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${SITE.lat},${SITE.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SITE.address || '')}`;


  return (
    <main style={{ maxWidth: 780, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Check Status</h1>
      <p style={{ opacity: .8, marginBottom: 16 }}>
        Use your <b>Confirmation #</b>, or <b>Tag + Last Name</b>.
      </p>

      <form onSubmit={lookup} style={{ display: 'grid', gap: 12 }}>
        <input
          value={confirmation}
          onChange={e=>setConfirmation(e.target.value)}
          placeholder="Confirmation #"
          inputMode="numeric"
          style={field}
          aria-label="Confirmation number"
        />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          <input
            value={tag}
            onChange={e=>setTag(e.target.value)}
            placeholder="Tag"
            style={field}
            aria-label="Tag number"
          />
          <input
            value={lastName}
            onChange={e=>setLastName(e.target.value)}
            placeholder="Last Name"
            style={field}
            aria-label="Customer last name"
          />
        </div>
        <button disabled={loading} style={btn} aria-busy={loading}>
          {loading ? 'Checking...' : 'Check status'}
        </button>
      </form>

      {err ? <div role="alert" style={errBox}>{err}</div> : null}

      {res ? (
        <div style={card}>
          {/* Summary */}
          <div style={{ display:'grid', gap:10 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              Status: <span style={pill}>{res.status || '—'}</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Info label="Tag" value={res.tag || '—'} />
              <Info label="Confirmation" value={res.confirmation || '—'} />
            </div>

            {/* Extra tracks (only show when present) */}
            <div style={{ marginTop: 6, display:'grid', gap:6 }}>
              {res.tracks?.webbsStatus ? (
                <Track label="Webbs" value={res.tracks.webbsStatus} />
              ) : null}
              {res.tracks?.specialtyStatus ? (
                <Track label="Specialty" value={res.tracks.specialtyStatus} />
              ) : null}
              {res.tracks?.capeStatus ? (
                <Track label="Cape" value={res.tracks.capeStatus} />
              ) : null}
            </div>
          </div>

          {/* Pickup panel (directions, hours, phone) */}
          <PickupPanel
            ready={isReady}
            addressText={SITE.address}
            mapsUrl={mapsUrl}
            phoneHref={phoneHref}
            phoneDisplay={SITE.phone}
            hours={SITE.hours}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 18, opacity: .8, fontSize: 13 }}>
        Tip: Don’t see your order? Try a different query (Confirmation # is best), or{' '}
        <Link href="/faq-public" style={{ color:'#a7e3ba', textDecoration:'underline' }}>check the FAQ</Link>.
      </div>
    </main>
  );
}

/* ---------- Small presentational bits (inline to keep this file self-contained) ---------- */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>{label}</div>
      <div style={valueBox}>{value}</div>
    </div>
  );
}

function Track({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <b>{label}:</b> <span style={pill}>{value}</span>
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
  hours: { label: string; value: string }[];
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
        <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>Pickup Location</div>
        <div style={{ opacity: 0.9 }}>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
            {addressText}
          </a>
        </div>
      </div>

      {hours?.length ? (
        <div>
          <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>Hours</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.9 }}>
            {hours.map((h, i) => (
              <li key={i}>{h.label} {h.value}</li>
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

/* ---------- styles ---------- */

const field: React.CSSProperties = {
  padding:'10px 12px',
  border:'1px solid #1f2937',
  borderRadius:10,
  background:'#0b0f12',
  color:'#e5e7eb'
};

const valueBox: React.CSSProperties = {
  padding:'6px 8px',
  border:'1px solid #1f2937',
  borderRadius:10,
  background:'#0b0f12',
  color:'#e5e7eb',
  fontWeight: 700,
};

const btn: React.CSSProperties = {
  display:'inline-block',
  padding:'10px 12px',
  border:'1px solid #1f2937',
  borderRadius:10,
  background:'#121821',
  color:'#e5e7eb',
  fontWeight:800,
  textDecoration:'none',
};

const btnGhost: React.CSSProperties = {
  ...btn,
  background:'transparent'
};

const card: React.CSSProperties = {
  marginTop:16,
  padding:16,
  border:'1px solid #1f2937',
  borderRadius:12,
  background:'#0b0f12',
  color:'#e5e7eb',
};

const errBox: React.CSSProperties = {
  marginTop:12,
  padding:12,
  border:'1px solid #7f1d1d',
  borderRadius:10,
  background:'rgba(127,29,29,.15)',
  color:'#fecaca'
};

const pill: React.CSSProperties = {
  display:'inline-block',
  border:'1px solid #1f2937',
  borderRadius:999,
  padding:'2px 8px',
  background:'#0b0f12',
  fontWeight:800
};
