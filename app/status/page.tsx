// app/status/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SITE, phoneHref } from '@/lib/config';

type LookupResult = {
  ok?: boolean;
  notFound?: boolean;
  error?: string;

  // identity
  customer?: string;
  tag?: string;
  confirmation?: string;

  // core (meat)
  status?: string;

  // extra tracks
  tracks?: {
    webbsStatus?: string;
    specialtyStatus?: string;
    capeStatus?: string;
  };

  // pricing (optional)
  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  priceTotal?: number | string;

  // paid flags (optional)
  paidProcessing?: boolean | string;
  paidSpecialty?: boolean | string;
  paid?: boolean | string;
};

export default function StatusPage() {
  // Smart single-input
  const [q, setQ] = useState('');
  // Advanced (original fields)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');

  // Result + UX
  const [res, setRes] = useState<LookupResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Polling (replace interval with backoff timeouts)
  const pollUntilRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const READY_WORDS = useMemo(() => ['ready', 'finished', 'complete', 'completed', 'done'], []);
  const text = (s?: string) => String(s || '').toLowerCase();

  const isReady = useMemo(() => {
    if (!res) return false;
    const t = res.tracks || {};
    return (
      READY_WORDS.some((w) => text(res.status).includes(w)) ||
      READY_WORDS.some((w) => text(t.capeStatus).includes(w)) ||
      READY_WORDS.some((w) => text(t.webbsStatus).includes(w)) ||
      READY_WORDS.some((w) => text(t.specialtyStatus).includes(w))
    );
  }, [res, READY_WORDS]);

  const toNum = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  };
  const toBool = (v: unknown) => {
    if (v === true) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'paid', '✓', '✔', 'x'].includes(s);
  };
  const money = (n?: number) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—');

  const priceProcessing = toNum(res?.priceProcessing);
  const priceSpecialty = toNum(res?.priceSpecialty);
  const priceTotal =
    toNum(res?.priceTotal) ??
    (typeof priceProcessing === 'number' || typeof priceSpecialty === 'number'
      ? (priceProcessing || 0) + (priceSpecialty || 0)
      : undefined);

  const hasAnyPricing =
    typeof priceProcessing === 'number' ||
    typeof priceSpecialty === 'number' ||
    typeof priceTotal === 'number';

  const paidOverall = toBool(res?.paid);
  const paidProc = toBool(res?.paidProcessing);
  const paidSpec = toBool(res?.paidSpecialty);
  const hasAnyPaid = [res?.paid, res?.paidProcessing, res?.paidSpecialty].some(
    (v) => v !== undefined && v !== null
  );

  // -------- Styles (inline to avoid CSS changes) --------
  const field: React.CSSProperties = { background: '#0f1416', color: '#e6e7eb', border: '1px solid #1f2937', borderRadius: 10, padding: '12px 14px' };
  const btn: React.CSSProperties = { background: '#2f6f3f', color: '#fff', border: '1px solid transparent', borderRadius: 10, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' };
  const errBox: React.CSSProperties = { marginTop: 12, border: '1px solid #7f1d1d', background: 'rgba(127,29,29,.15)', color: '#fecaca', borderRadius: 10, padding: 10 };
  const card: React.CSSProperties = { marginTop: 14, border: '1px solid #1f2937', borderRadius: 12, background: '#0b0f12', padding: 12, color: '#e6e7eb' };
  const valueBox: React.CSSProperties = { background: '#0f1416', border: '1px solid #1f2937', borderRadius: 10, padding: '8px 10px' };
  const pill: React.CSSProperties = { display: 'inline-block', border: '1px solid #2a5f47', background: '#193b2e', color: '#a7e3ba', borderRadius: 999, padding: '4px 10px', fontWeight: 800 };

  const mapsUrl = SITE.mapsUrl;

  // -------- Query parsing (keeps your API contract) --------
  function parseQuery(input: string): { confirmation?: string; tag?: string; lastName?: string } {
    const s = input.trim();
    if (!s) return {};
    // If looks like "123456" => confirmation
    if (/^\d+$/.test(s)) return { confirmation: s };
    // If looks like "54321 Janes" => tag + last
    const m = s.match(/^(\d+)\s+([a-zA-Z'-]+)$/);
    if (m) return { tag: m[1], lastName: m[2] };
    // If looks like "Janes" => last name only (advanced API may still match)
    if (/^[a-zA-Z'-]+$/.test(s)) return { lastName: s };
    // Fallback: try as confirmation first
    return { confirmation: s.replace(/\D/g, '') || undefined };
  }

  // -------- Lookup --------
  const doLookup = useCallback(
    async (payload: { confirmation?: string; tag?: string; lastName?: string }) => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/public-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = (await r.json()) as LookupResult;
        if (!j?.ok) {
          setRes(null);
          setErr(j?.error || (j?.notFound ? 'No match found.' : 'Not found.'));
        } else {
          setRes(j);
          setLastUpdatedAt(Date.now());
        }
      } catch (e: any) {
        setRes(null);
        setErr(e?.message || 'Lookup failed.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function clearPolling() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const base = parseQuery(q);
    const payload = showAdvanced
      ? {
          confirmation: confirmation || base.confirmation,
          tag: tag || base.tag,
          lastName: lastName || base.lastName,
        }
      : base;

    if (!payload.confirmation && !payload.tag && !payload.lastName) {
      setErr('Enter a Confirmation # or Tag + Last Name.');
      return;
    }

    // Do an immediate lookup
    doLookup(payload);

    // Start a backoff polling cycle: 30s → 60s → 120s, stop after 5 min or when ready
    clearPolling();
    pollUntilRef.current = Date.now() + 5 * 60 * 1000; // 5 minutes
    const DELAYS = [30_000, 60_000, 120_000];
    let i = 0;

    const tick = async () => {
      // stop conditions
      if (!pollUntilRef.current || Date.now() > pollUntilRef.current) return;
      if (document.hidden) {
        // If tab hidden, chill a bit and try again
        timeoutRef.current = setTimeout(tick, 15_000);
        return;
      }

      await doLookup(payload);

      // If the order is ready, stop polling
      if (isReady) return;

      const nextDelay = DELAYS[Math.min(i++, DELAYS.length - 1)];
      timeoutRef.current = setTimeout(tick, nextDelay);
    };

    timeoutRef.current = setTimeout(tick, DELAYS[0]);
  }

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      clearPolling();
    };
  }, []);

  // -------- Optional barcode/QR scan (progressive enhancement) --------
  async function handleScan() {
    try {
      // Only show if supported
      // @ts-ignore
      if (!('BarcodeDetector' in window)) return;
      // @ts-ignore
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      // Simple single-frame attempt (keep it lightweight)
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      // @ts-ignore
      const codes = await detector.detect(bitmap);
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      if (codes?.[0]?.rawValue) {
        const raw = String(codes[0].rawValue).trim();
        setQ(/^\d+$/.test(raw) ? raw : raw.replace(/\s+/g, ' '));
      }
    } catch {
      // Silent fail
    }
  }

  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && 'mediaDevices' in navigator;

  // -------- UI --------
  return (
    <main style={{ maxWidth: 780, margin: '20px auto', padding: '0 12px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Check Status</h1>
      <p style={{ opacity: 0.8, marginBottom: 12 }}>
        Search by <b>Confirmation #</b> or <b>Tag + Last Name</b>.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g., 123456  •  or  54321 Janes"
            inputMode="text"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ ...field, flex: 1 }}
            aria-label="Search by Confirmation # or Tag and Last Name"
          />
          {canScan ? (
            <button type="button" onClick={handleScan} title="Scan code" style={{ ...btn, whiteSpace: 'nowrap' }}>
              Scan
            </button>
          ) : null}
        </div>

        <details style={{ marginTop: 2 }}>
          <summary style={{ cursor: 'pointer' }} onClick={() => setShowAdvanced((v) => !v)}>
            Advanced (enter fields separately)
          </summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Confirmation #"
              inputMode="numeric"
              aria-label="Confirmation number"
              style={field}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag" aria-label="Tag number" style={field} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" aria-label="Customer last name" style={field} />
            </div>
          </div>
        </details>

        <button disabled={loading} style={btn} aria-busy={loading}>
          {loading ? 'Checking…' : 'Check status'}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Tip: Confirmation # is fastest. For Tag search, type it like <code>54321 Janes</code>.
        </div>
      </form>

      {err ? (
        <div role="alert" aria-live="polite" style={errBox}>
          {err}
        </div>
      ) : null}

      {res ? (
        <div style={card}>
          <div style={{ display: 'grid', gap: 10 }}>
            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Info label="Customer" value={res.customer || '—'} valueBox={valueBox} />
              <Info label="Confirmation" value={res.confirmation || '—'} valueBox={valueBox} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Info label="Tag" value={res.tag || '—'} valueBox={valueBox} />
              <Info label="Overall Status (Meat)" value={res.status || '—'} valueBox={valueBox} />
            </div>

            {/* Tracks */}
            <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
              {res.tracks?.capeStatus ? <Track label="Cape" value={res.tracks.capeStatus} pill={pill} /> : null}
              {res.tracks?.webbsStatus ? <Track label="Webbs" value={res.tracks.webbsStatus} pill={pill} /> : null}
              {res.tracks?.specialtyStatus ? <Track label="Specialty" value={res.tracks.specialtyStatus} pill={pill} /> : null}
            </div>

            {/* Payment */}
            {(hasAnyPricing || hasAnyPaid) && (
              <section aria-label="Payment" style={{ marginTop: 8, border: '1px solid #1f2937', borderRadius: 10, background: '#0b0f12', padding: 10, display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 900, color: '#d4e7db' }}>Payment</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Info label="Processing" value={money(priceProcessing)} valueBox={valueBox} />
                  <Info label="Specialty" value={money(priceSpecialty)} valueBox={valueBox} />
                  <Info label="Total" value={money(priceTotal)} valueBox={valueBox} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {hasAnyPaid && (
                    <>
                      <Badge ok={paidOverall} label={paidOverall ? 'Paid (overall)' : 'Unpaid (overall)'} />
                      {'paidProcessing' in (res || {}) ? (
                        <Badge ok={paidProc} label={paidProc ? 'Processing Paid' : 'Processing Unpaid'} />
                      ) : null}
                      {'paidSpecialty' in (res || {}) ? (
                        <Badge ok={paidSpec} label={paidSpec ? 'Specialty Paid' : 'Specialty Unpaid'} />
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Pickup panel */}
          <PickupPanel
            ready={isReady}
            addressText={SITE.address}
            mapsUrl={mapsUrl}
            phoneHref={phoneHref}
            phoneDisplay={SITE.phone}
            hours={SITE.hours as ReadonlyArray<{ label: string; value: string }>}
            lastUpdatedAt={lastUpdatedAt}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 18, opacity: 0.8, fontSize: 13 }}>
        Don’t see your order? Try a different query (Confirmation # is best), or{' '}
        <Link href="/faq-public" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
          check the FAQ
        </Link>
        .
      </div>
    </main>
  );
}

function Info({ label, value, valueBox }: { label: string; value: string; valueBox: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={valueBox}>{value}</div>
    </div>
  );
}

function Track({ label, value, pill }: { label: string; value?: string; pill: React.CSSProperties }) {
  if (!value) return null;
  return (
    <div>
      <b style={{ opacity: 0.85 }}>{label}:</b> <span style={pill}>{value}</span>
    </div>
  );
}

function Badge({ ok, label }: { ok?: boolean; label: string }) {
  const style: React.CSSProperties = ok
    ? { display: 'inline-block', border: '1px solid #2a5f47', background: '#193b2e', color: '#a7e3ba', borderRadius: 999, padding: '4px 10px', fontWeight: 800 }
    : { display: 'inline-block', border: '1px solid #7f1d1d', background: 'rgba(127,29,29,.15)', color: '#fecaca', borderRadius: 999, padding: '4px 10px', fontWeight: 800 };
  return <span style={style}>{label}</span>;
}

function PickupPanel({
  ready,
  addressText,
  mapsUrl,
  phoneHref,
  phoneDisplay,
  hours,
  lastUpdatedAt,
}: {
  ready: boolean;
  addressText: string;
  mapsUrl: string;
  phoneHref: string;
  phoneDisplay: string;
  hours: ReadonlyArray<{ label: string; value: string }>;
  lastUpdatedAt: number | null;
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
        <div style={{ background: '#193b2e', border: '1px solid #2a5f47', color: '#a7e3ba', borderRadius: 10, padding: '8px 10px', fontWeight: 800 }}>
          Ready for pickup
        </div>
      )}

      {lastUpdatedAt ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</div>
      ) : null}

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
              <li key={i}>
                {h.label}: {h.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div style={{ fontWeight: 900, color: '#d4e7db', marginBottom: 2 }}>Call Us</div>
        <a href={phoneHref} style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
          {phoneDisplay}
        </a>
      </div>
    </section>
  );
}
