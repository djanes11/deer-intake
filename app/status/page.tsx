'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SITE, phoneHref } from '@/lib/config';

type LookupResult = {
  ok?: boolean;
  notFound?: boolean;
  error?: string;
  customer?: string;
  tag?: string;
  confirmation?: string;
  status?: string;
  tracks?: {
    webbsStatus?: string;
    specialtyStatus?: string;
    capeStatus?: string;
  };
  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  priceTotal?: number | string;
  paidProcessing?: boolean | string;
  paidSpecialty?: boolean | string;
  paid?: boolean | string;
};

type StatusTone = 'ready' | 'progress' | 'hold' | 'unknown';

type TrackSummary = {
  key: string;
  label: string;
  value?: string;
  tone: StatusTone;
  message: string;
};

type PaymentCardProps = {
  label: string;
  amount?: number;
  paid?: boolean;
  owed?: number;
};

const READY_WORDS = ['ready', 'finished', 'complete', 'completed', 'done'];
const HOLD_WORDS = ['hold', 'waiting', 'pending', 'not started', 'dropped off', 'drop off', 'received'];
const PROGRESS_WORDS = ['process', 'cut', 'grind', 'smoke', 'cure', 'working', 'started', 'in progress', 'calling'];

const tones: Record<StatusTone, { border: string; background: string; text: string }> = {
  ready: { border: '#2a5f47', background: '#193b2e', text: '#a7e3ba' },
  progress: { border: '#6b4f1d', background: 'rgba(146, 108, 40, 0.18)', text: '#f4d08c' },
  hold: { border: '#334155', background: '#111827', text: '#dbe3ef' },
  unknown: { border: '#334155', background: '#0f1416', text: '#dbe3ef' },
};

function text(s?: string) {
  return String(s || '').toLowerCase();
}

function toNum(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'paid', 'x', 'on'].includes(s);
}

function money(n?: number) {
  return typeof n === 'number' ? `$${n.toFixed(2)}` : '-';
}

function normalizeName(n?: string) {
  return (n || '').trim().replace(/[^a-zA-Z'-]/g, '');
}

function statusTone(status?: string): StatusTone {
  const value = text(status);
  if (!value) return 'unknown';
  if (READY_WORDS.some((word) => value.includes(word))) return 'ready';
  if (PROGRESS_WORDS.some((word) => value.includes(word))) return 'progress';
  if (HOLD_WORDS.some((word) => value.includes(word))) return 'hold';
  return 'unknown';
}

function statusMessage(label: string, status?: string) {
  const tone = statusTone(status);
  const value = text(status);
  if (value.includes('called')) return `Please contact the shop about your ${label.toLowerCase()}.`;
  if (value.includes('picked up')) return `Your ${label.toLowerCase()} has already been picked up.`;
  if (tone === 'ready') return `Your ${label.toLowerCase()} is ready for pickup.`;
  if (tone === 'progress') return `Your ${label.toLowerCase()} is still being worked on.`;
  if (tone === 'hold') return `We have your ${label.toLowerCase()} and it is waiting for the next step.`;
  return `We will update this page as your ${label.toLowerCase()} moves through the shop.`;
}

function customerFacingStatus(status?: string) {
  const value = text(status);
  if (!value) return 'Not posted yet';
  if (value.includes('called')) return 'Please contact us';
  if (value.includes('picked up')) return 'Picked up';
  if (READY_WORDS.some((w) => value.includes(w))) return 'Ready for pickup';
  if (PROGRESS_WORDS.some((w) => value.includes(w))) return 'Still being worked on';
  if (HOLD_WORDS.some((w) => value.includes(w))) return 'We have it';
  return 'Status updated';
}

function trackSummaries(res: LookupResult | null): TrackSummary[] {
  if (!res) return [];
  const tracks = res.tracks || {};
  return [
    {
      key: 'meat',
      label: 'Processing',
      value: res.status,
      tone: statusTone(res.status),
      message: statusMessage('Processing', res.status),
    },
    {
      key: 'cape',
      label: 'Cape',
      value: tracks.capeStatus,
      tone: statusTone(tracks.capeStatus),
      message: statusMessage('Cape', tracks.capeStatus),
    },
    {
      key: 'webbs',
      label: 'Webbs',
      value: tracks.webbsStatus,
      tone: statusTone(tracks.webbsStatus),
      message: statusMessage('Webbs', tracks.webbsStatus),
    },
    {
      key: 'specialty',
      label: 'Specialty',
      value: tracks.specialtyStatus,
      tone: statusTone(tracks.specialtyStatus),
      message: statusMessage('Specialty', tracks.specialtyStatus),
    },
  ].filter((item) => item.value);
}

export default function StatusPage() {
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');
  const [res, setRes] = useState<LookupResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [publicHours, setPublicHours] = useState<ReadonlyArray<{ label: string; value: string }>>(
    SITE.hours as ReadonlyArray<{ label: string; value: string }>
  );

  const pollUntilRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestReadyRef = useRef(false);

  const isReady = useMemo(() => {
    if (!res) return false;
    const t = res.tracks || {};
    return (
      READY_WORDS.some((w) => text(res.status).includes(w)) ||
      READY_WORDS.some((w) => text(t.capeStatus).includes(w)) ||
      READY_WORDS.some((w) => text(t.webbsStatus).includes(w)) ||
      READY_WORDS.some((w) => text(t.specialtyStatus).includes(w))
    );
  }, [res]);

  useEffect(() => {
    latestReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j?.settings?.hours) && j.settings.hours.length) {
          setPublicHours(
            j.settings.hours.map((h: any) => ({
              label: String(h?.label || ''),
              value: String(h?.value || ''),
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const priceProcessing = toNum(res?.priceProcessing);
  const priceSpecialty = toNum(res?.priceSpecialty);
  const rawPriceTotal = toNum(res?.priceTotal);
  const computedLineTotal =
    typeof priceProcessing === 'number' || typeof priceSpecialty === 'number'
      ? (priceProcessing || 0) + (priceSpecialty || 0)
      : undefined;
  const priceTotal =
    typeof computedLineTotal === 'number' &&
    (rawPriceTotal === undefined || rawPriceTotal <= 0 || computedLineTotal > rawPriceTotal)
      ? computedLineTotal
      : rawPriceTotal;

  const rawPaidOverall = toBool(res?.paid);
  const rawPaidProc = toBool(res?.paidProcessing);
  const rawPaidSpec = toBool(res?.paidSpecialty);
  const paidProc =
    rawPaidProc !== undefined
      ? rawPaidProc
      : rawPaidOverall !== undefined && (!priceProcessing || priceProcessing <= 0)
        ? rawPaidOverall
        : undefined;
  const paidSpec =
    rawPaidSpec !== undefined
      ? rawPaidSpec
      : rawPaidOverall !== undefined && (!priceSpecialty || priceSpecialty <= 0)
        ? rawPaidOverall
        : undefined;
  const paidOverall =
    [paidProc, paidSpec].some((v) => v !== undefined)
      ? [paidProc, paidSpec].every((v, i) =>
          i === 1 && (!priceSpecialty || priceSpecialty <= 0) ? true : v !== false
        ) && [paidProc, paidSpec].some((v) => v === true)
      : rawPaidOverall;
  const hasAnyPaid = [res?.paid, res?.paidProcessing, res?.paidSpecialty].some(
    (v) => v !== undefined && v !== null && String(v) !== ''
  );
  const hasAnyPricing =
    typeof priceProcessing === 'number' ||
    typeof priceSpecialty === 'number' ||
    typeof priceTotal === 'number';

  const owedProcessing =
    paidProc === true ? 0 : typeof priceProcessing === 'number' ? priceProcessing : undefined;
  const owedSpecialty =
    paidSpec === true ? 0 : typeof priceSpecialty === 'number' ? priceSpecialty : undefined;
  const owedTotal =
    paidOverall === true
      ? 0
      : typeof owedProcessing === 'number' || typeof owedSpecialty === 'number'
        ? (owedProcessing || 0) + (owedSpecialty || 0)
        : typeof priceTotal === 'number'
          ? priceTotal
          : undefined;

  const summaries = useMemo(() => trackSummaries(res), [res]);
  const currentStage = summaries[0];
  const mapsUrl = SITE.mapsUrl;

  const field: React.CSSProperties = {
    background: '#0f1416',
    color: '#e6e7eb',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '13px 14px',
  };
  const card: React.CSSProperties = {
    border: '1px solid #1f2937',
    borderRadius: 18,
    background: '#0b0f12',
    color: '#e6e7eb',
  };
  const sectionCard: React.CSSProperties = {
    border: '1px solid #1f2937',
    borderRadius: 14,
    background: '#11161b',
    padding: 14,
  };
  const primaryBtn: React.CSSProperties = {
    background: '#2f6f3f',
    color: '#fff',
    border: '1px solid transparent',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  };
  const secondaryBtn: React.CSSProperties = {
    background: '#11161b',
    color: '#e6e7eb',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  };
  const valueBox: React.CSSProperties = {
    background: '#0f1416',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '10px 12px',
  };
  const errBox: React.CSSProperties = {
    marginTop: 12,
    border: '1px solid #7f1d1d',
    background: 'rgba(127,29,29,.15)',
    color: '#fecaca',
    borderRadius: 12,
    padding: 12,
  };

  async function postStatus(payload: { confirmation?: string; tag?: string; lastName?: string }) {
    const r = await fetch('/api/public-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await r.json()) as LookupResult;
  }

  const doLookupChain = useCallback(async (payload: { confirmation?: string; tag?: string; lastName?: string }) => {
    setLoading(true);
    setErr(null);
    try {
      const attempts: Array<{ confirmation?: string; tag?: string; lastName?: string }> = [];

      if (payload.confirmation) {
        attempts.push({ confirmation: payload.confirmation });
      } else if (payload.tag && payload.lastName) {
        attempts.push({ tag: payload.tag, lastName: payload.lastName });
        attempts.push({ tag: payload.tag });
        attempts.push({ lastName: payload.lastName });
      } else if (payload.tag) {
        attempts.push({ tag: payload.tag });
      } else if (payload.lastName) {
        attempts.push({ lastName: payload.lastName });
      } else {
        setRes(null);
        setErr('Enter your confirmation number or your tag and last name.');
        return;
      }

      let lastErr: string | null = null;
      for (const p of attempts) {
        const resp = await postStatus(p);
        if (resp?.ok) {
          setRes(resp);
          setLastUpdatedAt(Date.now());
          return;
        }
        if (resp?.error && !resp?.notFound) {
          lastErr = resp.error;
          break;
        }
      }

      setRes(null);
      setErr(lastErr || 'No deer matched that search. Try your confirmation number first.');
    } catch (e: any) {
      setRes(null);
      setErr(e?.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const doLookup = useCallback(
    async (payload: { confirmation?: string; tag?: string; lastName?: string }) => doLookupChain(payload),
    [doLookupChain]
  );

  function clearPolling() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      confirmation: confirmation.replace(/\D/g, ''),
      tag: tag.trim(),
      lastName: normalizeName(lastName),
    };

    if (!payload.confirmation && !(payload.tag && payload.lastName)) {
      setErr('Enter your confirmation number, or enter your tag number and last name.');
      return;
    }

    doLookup(payload);

    clearPolling();
    pollUntilRef.current = Date.now() + 5 * 60 * 1000;
    const delays = [30_000, 60_000, 120_000];
    let i = 0;

    const tick = async () => {
      if (!pollUntilRef.current || Date.now() > pollUntilRef.current) return;
      if (document.hidden) {
        timeoutRef.current = setTimeout(tick, 15_000);
        return;
      }

      await doLookup(payload);
      if (latestReadyRef.current) return;

      const nextDelay = delays[Math.min(i++, delays.length - 1)];
      timeoutRef.current = setTimeout(tick, nextDelay);
    };

    timeoutRef.current = setTimeout(tick, delays[0]);
  }

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  async function handleScan() {
    try {
      // @ts-ignore
      if (!('BarcodeDetector' in window)) return;
      // @ts-ignore
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
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
        if (/^\d+$/.test(raw)) {
          setConfirmation(raw);
        } else {
          setTag(raw.replace(/\s+/g, ' '));
        }
      }
    } catch {
      // ignore scan failures
    }
  }

  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && 'mediaDevices' in navigator;

  return (
    <main style={{ maxWidth: 920, margin: '20px auto', padding: '0 12px 28px' }}>
      <section style={{ ...card, padding: 18 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Check Your Deer Status</h1>
            <p style={{ opacity: 0.86, margin: '8px 0 0' }}>
              Use your confirmation number, or use your deer tag and last name after staff have assigned the real tag.
            </p>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              <div style={sectionCard}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Search by Confirmation Number</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
                  Best for public intake forms before a deer tag has been assigned.
                </div>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Confirmation #"
                  inputMode="numeric"
                  aria-label="Confirmation number"
                  style={{ ...field, width: '100%' }}
                />
              </div>

              <div style={sectionCard}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Search by Tag and Last Name</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
                  Use this after staff have assigned the real deer tag.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag number" aria-label="Tag number" style={field} />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    aria-label="Customer last name"
                    style={field}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {canScan ? (
                <button type="button" onClick={handleScan} title="Scan code" style={{ ...secondaryBtn, whiteSpace: 'nowrap' }}>
                  Scan
                </button>
              ) : null}
              <button disabled={loading} style={primaryBtn} aria-busy={loading}>
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>

            <div style={{ fontSize: 13, opacity: 0.82 }}>
              Search with a confirmation number, or with both tag number and last name.
            </div>
          </form>
        </div>
      </section>

      {err ? (
        <div role="alert" aria-live="polite" style={errBox}>
          {err}
        </div>
      ) : null}

      {res ? (
        <section style={{ ...card, marginTop: 16, padding: 18, display: 'grid', gap: 16 }}>
          <div
            style={{
              ...sectionCard,
              borderColor: tones[currentStage?.tone || 'unknown'].border,
              background: currentStage?.tone === 'ready' ? '#11251c' : sectionCard.background,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 4 }}>Order found</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{res.customer || 'Customer'}</div>
                <div style={{ opacity: 0.86, marginTop: 4 }}>
                  Confirmation {res.confirmation || '-'} {res.tag ? `| Tag ${res.tag}` : ''}
                </div>
              </div>
              {currentStage ? (
              <StatusPill tone={currentStage.tone} label={customerFacingStatus(currentStage.value) || 'Status pending'} />
              ) : null}
            </div>
            {currentStage ? (
              <p style={{ margin: '12px 0 0', opacity: 0.9 }}>{currentStage.message}</p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <SummaryCard
              title="Current status"
              value={customerFacingStatus(currentStage?.value || res.status) || 'Status pending'}
              note={currentStage?.message || 'We will keep this page updated as your deer moves through the shop.'}
            />
            <SummaryCard
              title="Balance due right now"
              value={money(owedTotal)}
              note={
                paidOverall
                  ? 'This order is marked paid.'
                  : typeof owedTotal === 'number'
                    ? 'This is the current balance showing in our system for processing and specialty items.'
                    : 'Pricing has not been posted yet.'
              }
            />
            <SummaryCard
              title="Payment"
              value={paidOverall ? 'Paid' : hasAnyPaid ? 'Partially paid or unpaid' : 'Not posted yet'}
              note={
                paidOverall
                  ? 'No additional balance is showing.'
                  : hasAnyPaid
                    ? 'See the payment breakdown below for what is paid and what is still owed.'
                    : 'Payment details will appear here once entered.'
              }
            />
          </div>

          <section style={sectionCard} aria-label="Status details">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Order Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {summaries.map((item) => (
                <TrackCard key={item.key} item={item} />
              ))}
            </div>
          </section>

          {(hasAnyPricing || hasAnyPaid) && (
            <section style={sectionCard} aria-label="Payment details">
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Payment Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <PaymentCard label="Processing" amount={priceProcessing} paid={paidOverall || paidProc} owed={owedProcessing} />
                <PaymentCard label="Specialty" amount={priceSpecialty} paid={paidOverall || paidSpec} owed={owedSpecialty} />
                <PaymentCard label="Total" amount={priceTotal} paid={paidOverall} owed={owedTotal} />
              </div>
            </section>
          )}

          <PickupPanel
            ready={isReady}
            addressText={SITE.address}
            mapsUrl={mapsUrl}
            phoneHref={phoneHref}
            phoneDisplay={SITE.phone}
            hours={publicHours}
            lastUpdatedAt={lastUpdatedAt}
          />
        </section>
      ) : null}

      <div style={{ marginTop: 18, opacity: 0.82, fontSize: 13 }}>
        Not seeing your order? Try your confirmation number first, or{' '}
        <Link href="/faq-public" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
          check the FAQ
        </Link>
        .
      </div>
    </main>
  );
}

function SummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div
      style={{
        border: '1px solid #1f2937',
        borderRadius: 14,
        background: '#11161b',
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>{value}</div>
      <div style={{ opacity: 0.84, lineHeight: 1.45 }}>{note}</div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const palette = tones[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        borderRadius: 999,
        padding: '8px 14px',
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function TrackCard({ item }: { item: TrackSummary }) {
  const palette = tones[item.tone];
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: '#0f1416',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.76 }}>{item.label}</div>
      <StatusPill tone={item.tone} label={item.value || 'Status pending'} />
      <div style={{ opacity: 0.84, lineHeight: 1.45 }}>{item.message}</div>
    </div>
  );
}

function PaymentCard({ label, amount, paid, owed }: PaymentCardProps) {
  return (
    <div
      style={{
        border: '1px solid #1f2937',
        borderRadius: 14,
        background: '#0f1416',
        padding: 14,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.76 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{money(amount)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge ok={!!paid} label={paid ? 'Paid' : 'Unpaid'} />
        {typeof owed === 'number' ? <Badge ok={owed === 0} label={owed === 0 ? 'Balance cleared' : `Owes ${money(owed)}`} /> : null}
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok?: boolean; label: string }) {
  const palette = ok ? tones.ready : tones.hold;
  return (
    <span
      style={{
        display: 'inline-block',
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        borderRadius: 999,
        padding: '4px 10px',
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
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
        border: '1px solid #1f2937',
        background: '#11161b',
        borderRadius: 14,
        padding: 14,
        color: '#e6e7eb',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Pickup Information</div>
          <div style={{ opacity: 0.84 }}>When your deer is ready, this is where to go and who to call.</div>
        </div>
        {ready ? <StatusPill tone="ready" label="Ready for pickup" /> : null}
      </div>

      {lastUpdatedAt ? (
        <div style={{ fontSize: 12, opacity: 0.78 }}>Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Location</div>
          <div>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
              {addressText}
            </a>
          </div>
        </div>

        {hours?.length ? (
          <div>
            <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Hours</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.92, display: 'grid', gap: 2 }}>
              {hours.map((h, i) => (
                <li key={i}>
                  {h.label}: {h.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Phone</div>
          <a href={phoneHref} style={{ color: '#a7e3ba', textDecoration: 'underline' }}>
            {phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
