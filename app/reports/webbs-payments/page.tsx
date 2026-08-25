'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type PaymentMethod = 'cash' | 'check' | 'card';

type WebbsPaymentRow = {
  id: string;
  tag: string;
  confirmation: string;
  customer: string;
  phone: string;
  dropoff: string | null;
  status: string;
  webbsStatus: string;
  requiresTag: boolean;
  priceProcessing: number;
  amountPaidProcessing: number;
  processingDue: number;
  paidProcessing: boolean;
  needsPriceReview: boolean;
  sourceLabel: string;
};

const API = '/api/v2/reports/webbs-payment-needed';

function money(value: number) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10) || '-';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function methodLabel(method: PaymentMethod) {
  if (method === 'card') return 'Card / Square';
  return method === 'cash' ? 'Cash' : 'Check';
}

async function readJson(r: Response) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || `HTTP ${r.status}` };
  }
}

export default function WebbsPaymentsPage() {
  const [rows, setRows] = useState<WebbsPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(API, { cache: 'no-store' });
      const json = await readJson(r);
      if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}`);
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    return {
      count: rows.length,
      due: rows.reduce((sum, row) => sum + Number(row.processingDue || 0), 0),
      priceReview: rows.filter((row) => row.needsPriceReview).length,
      publicIntakes: rows.filter((row) => row.requiresTag).length,
    };
  }, [rows]);

  const markPaid = async (row: WebbsPaymentRow, method: PaymentMethod) => {
    const tag = String(row.tag || '').trim();
    if (!tag) return;
    if (row.needsPriceReview) {
      setError('Set the processing price before marking this Webbs order paid.');
      return;
    }
    const ok = window.confirm(`Mark processing paid by ${methodLabel(method)} for ${row.customer || tag}?`);
    if (!ok) return;

    setError('');
    setMessage('');
    setBusyKey(`${tag}:${method}`);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ tag, method }),
      });
      const json = await readJson(r);
      if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}`);
      setRows((prev) => prev.filter((item) => item.tag !== tag));
      setMessage(
        `Marked ${row.customer || tag} paid by ${methodLabel(method)}.` +
        (json?.squarePaymentLinkWarning ? ` ${json.squarePaymentLinkWarning}` : '')
      );
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
      <section
        style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: '#f8fafc',
          border: '1px solid #334155',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#cbd5e1' }}>
          Webbs checkpoint
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Webbs Processing Payments</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 820, lineHeight: 1.5 }}>
          Every Webbs order here still needs regular processing payment collected or reviewed before it should move forward.
          Public overnight customers can pay online after saving. Use this page when staff collects regular processing in person by cash, check, or card.
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Metric label="Need payment" value={String(totals.count)} />
        <Metric label="Processing due" value={money(totals.due)} />
        <Metric label="Needs price review" value={String(totals.priceReview)} />
        <Metric label="Public intakes" value={String(totals.publicIntakes)} />
      </section>

      {message ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 800 }}>
          {message}
        </div>
      ) : null}
      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      <section style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Unpaid Webbs Processing</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Webbs product prices stay separate. This queue is only regular processing.
            </div>
          </div>
          <button className="btn" onClick={load} disabled={loading || !!busyKey}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: '#64748b' }}>Loading Webbs payment queue...</div>
        ) : !rows.length ? (
          <div style={{ padding: 18, display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 900, color: '#166534' }}>No Webbs processing payments are waiting.</div>
            <div style={{ color: '#64748b' }}>Any new Webbs order without processing payment will show here automatically.</div>
          </div>
        ) : (
          <div style={{ display: 'grid' }}>
            {rows.map((row, idx) => {
              const identity = row.tag || row.confirmation || row.id;
              const openHref = row.requiresTag ? '/overnight/review' : `/intake/${encodeURIComponent(row.tag)}`;
              return (
                <div
                  key={row.id || identity}
                  style={{
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                    borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
                    background: idx % 2 ? '#fbfdff' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 4, minWidth: 240 }}>
                      <div style={{ fontWeight: 950, fontSize: 18, color: '#0f172a' }}>
                        {row.customer || 'Unknown customer'}
                      </div>
                      <div style={{ color: '#475569', fontSize: 14 }}>
                        {row.requiresTag ? 'Needs tag' : `Tag ${row.tag || '-'}`} | Confirmation {row.confirmation || '-'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        {row.phone || 'No phone'} | Drop-off {formatDate(row.dropoff)} | {row.sourceLabel}
                      </div>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <div style={{ fontSize: 24, fontWeight: 950, color: row.needsPriceReview ? '#b45309' : '#166534' }}>
                        {row.needsPriceReview ? 'Review price' : money(row.processingDue)}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        Processing charge {money(row.priceProcessing)} | Paid {money(row.amountPaidProcessing)}
                      </div>
                    </div>
                  </div>

                  {row.needsPriceReview ? (
                    <div style={{ padding: 10, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontWeight: 800 }}>
                      Processing price is missing. Open the intake, confirm the processing charge, then collect payment.
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Link className="btn secondaryBtn" href={openHref} style={{ textDecoration: 'none' }}>
                      {row.requiresTag ? 'Review Public Intake' : 'Open Intake'}
                    </Link>
                    <Link className="btn secondaryBtn" href={`/search?q=${encodeURIComponent(identity)}`} style={{ textDecoration: 'none' }}>
                      Search
                    </Link>
                    {(['cash', 'check', 'card'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        className="btn"
                        type="button"
                        disabled={!!busyKey || row.needsPriceReview}
                        onClick={() => markPaid(row, method)}
                      >
                        {busyKey === `${row.tag}:${method}` ? 'Saving...' : `Paid ${methodLabel(method)}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(200,138,61,.18)',
        borderRadius: 16,
        padding: 16,
        background: 'rgba(14,13,12,.88)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8, color: '#f8fafc' }}>{value}</div>
    </div>
  );
}
