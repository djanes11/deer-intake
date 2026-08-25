'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SquareRow = {
  id: string;
  jobId: string;
  tag: string;
  confirmation: string;
  customer: string;
  status: string;
  squareEnvironment: string;
  checkoutUrl: string;
  squarePaymentId: string;
  squareOrderId: string;
  createdAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  lastEventAt: string | null;
  paymentConfirmedAt: string | null;
  amountCents: number;
  processingAmountCents: number;
  onlineFeeCents: number;
  appProcessingPrice: number;
  appProcessingPaid: number;
  appPaidProcessing: boolean;
  appPaymentMethod: string;
  issueLevel: 'critical' | 'warning' | 'ok';
  issueLabels: string[];
  category: 'needs_attention' | 'open' | 'paid';
};

type Summary = {
  total: number;
  openLinks: number;
  needsAttention: number;
  completedNotApplied: number;
  paidOk: number;
  squarePaidCents: number;
  openLinkCents: number;
};

const API = '/api/v2/reports/square-reconciliation';

function moneyCents(value: number) {
  return `$${((Number(value) || 0) / 100).toFixed(2)}`;
}

function money(value: number) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shortId(value: string) {
  return value ? value.slice(0, 8) : '-';
}

function customerHref(row: SquareRow) {
  if (row.tag) return `/intake/${encodeURIComponent(row.tag)}`;
  if (row.confirmation) return `/search?q=${encodeURIComponent(row.confirmation)}`;
  return '/search';
}

async function readJson(r: Response) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || `HTTP ${r.status}` };
  }
}

function issueTone(level: SquareRow['issueLevel']) {
  if (level === 'critical') return { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', label: 'Critical' };
  if (level === 'warning') return { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', label: 'Watch' };
  return { bg: '#ecfdf3', fg: '#166534', border: '#bbf7d0', label: 'OK' };
}

function emptySummary(): Summary {
  return {
    total: 0,
    openLinks: 0,
    needsAttention: 0,
    completedNotApplied: 0,
    paidOk: 0,
    squarePaidCents: 0,
    openLinkCents: 0,
  };
}

export default function SquareReconciliationPage() {
  const [rows, setRows] = useState<SquareRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'needs_attention' | 'open' | 'paid' | 'all'>('needs_attention');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(API, { cache: 'no-store' });
      const json = await readJson(r);
      if (!r.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${r.status}`);
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setSummary(json.summary || emptySummary());
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.category !== filter) return false;
      if (!q) return true;
      return [
        row.customer,
        row.tag,
        row.confirmation,
        row.status,
        row.issueLabels.join(' '),
        row.squarePaymentId,
        row.squareOrderId,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [rows, filter, search]);

  return (
    <main className="app-frame">
      <section className="app-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div className="app-kicker">Payment safety</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>Square Reconciliation</h1>
            <div className="app-copy">
              Confirm Square payments made it back into the app, and catch any open links or paid orders that need staff review.
            </div>
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Metric label="Needs Attention" value={String(summary.needsAttention)} tone={summary.needsAttention ? 'bad' : 'good'} />
        <Metric label="Completed Not Applied" value={String(summary.completedNotApplied)} tone={summary.completedNotApplied ? 'bad' : 'good'} />
        <Metric label="Open Links" value={String(summary.openLinks)} sub={moneyCents(summary.openLinkCents)} tone={summary.openLinks ? 'watch' : 'good'} />
        <Metric label="Square Confirmed" value={moneyCents(summary.squarePaidCents)} sub={`${summary.paidOk} applied`} tone="good" />
      </section>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      <section className="app-surface-light" style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="app-section-head">
            <div className="app-section-title">Audit Trail</div>
            <div className="app-section-copy">
              Start with attention items, then use open or paid views when balancing Square against the app.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              aria-label="Filter Square payment rows"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{ minWidth: 180 }}
            >
              <option value="needs_attention">Needs attention</option>
              <option value="open">Open links</option>
              <option value="paid">Square paid</option>
              <option value="all">All rows</option>
            </select>
            <input
              aria-label="Search Square payment rows"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, tag, confirmation"
              style={{ minWidth: 260 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: '#475569' }}>Loading Square payment report...</div>
        ) : !filtered.length ? (
          <div style={{ padding: 18, display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 900, color: '#166534' }}>
              {filter === 'needs_attention' ? 'No Square payment issues need attention.' : 'No Square payments match this view.'}
            </div>
            <div style={{ color: '#475569' }}>
              New Square links and completed payments will appear here automatically.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 1030, display: 'grid' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(210px,1.15fr) 130px 170px 160px minmax(260px,1.4fr) 150px',
                  background: '#f3f6f9',
                  border: '1px solid #dbe4ee',
                  borderRadius: '12px 12px 0 0',
                  color: '#0f172a',
                  fontWeight: 900,
                }}
              >
                <Cell head>Customer</Cell>
                <Cell head>Square</Cell>
                <Cell head>App Payment</Cell>
                <Cell head>Confirmed</Cell>
                <Cell head>Issue</Cell>
                <Cell head>Action</Cell>
              </div>

              {filtered.map((row, idx) => {
                const tone = issueTone(row.issueLevel);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(210px,1.15fr) 130px 170px 160px minmax(260px,1.4fr) 150px',
                      borderLeft: '1px solid #dbe4ee',
                      borderRight: '1px solid #dbe4ee',
                      borderBottom: '1px solid #dbe4ee',
                      background: idx % 2 ? '#fbfdff' : '#ffffff',
                    }}
                  >
                    <Cell>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <Link href={customerHref(row)} style={{ color: '#0f172a', fontWeight: 900, textDecoration: 'none' }}>
                          {row.customer || 'Unknown customer'}
                        </Link>
                        <div style={{ color: '#475569', fontSize: 13 }}>
                          {row.tag ? `Tag ${row.tag}` : 'No tag'} | Conf {row.confirmation || '-'}
                        </div>
                      </div>
                    </Cell>
                    <Cell>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ color: row.status === 'completed' ? '#166534' : '#92400e', textTransform: 'capitalize' }}>{row.status}</strong>
                        <span>{moneyCents(row.amountCents)}</span>
                        <span style={{ color: '#64748b', fontSize: 12 }}>Fee {moneyCents(row.onlineFeeCents)}</span>
                      </div>
                    </Cell>
                    <Cell>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ color: row.appPaidProcessing ? '#166534' : '#991b1b' }}>
                          {row.appPaidProcessing ? 'Paid' : 'Not paid'}
                        </strong>
                        <span>{money(row.appProcessingPaid)} / {money(row.appProcessingPrice)}</span>
                        <span style={{ color: '#64748b', fontSize: 12 }}>{row.appPaymentMethod}</span>
                      </div>
                    </Cell>
                    <Cell>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ color: row.paymentConfirmedAt ? '#166534' : '#92400e' }}>
                          {row.paymentConfirmedAt ? 'Confirmed' : 'Waiting'}
                        </strong>
                        <span style={{ color: '#64748b', fontSize: 12 }}>{formatDate(row.paymentConfirmedAt || row.lastEventAt || row.createdAt)}</span>
                      </div>
                    </Cell>
                    <Cell>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <span
                          style={{
                            justifySelf: 'start',
                            padding: '4px 9px',
                            borderRadius: 999,
                            background: tone.bg,
                            color: tone.fg,
                            border: `1px solid ${tone.border}`,
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          {tone.label}
                        </span>
                        <div style={{ display: 'grid', gap: 4 }}>
                          {row.issueLabels.map((label) => (
                            <span key={label} style={{ color: '#334155', fontSize: 13 }}>{label}</span>
                          ))}
                        </div>
                      </div>
                    </Cell>
                    <Cell>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link className="btn secondary" href={customerHref(row)} style={{ textDecoration: 'none' }}>
                          Open Job
                        </Link>
                        {row.checkoutUrl && row.status !== 'completed' ? (
                          <a className="btn secondary" href={row.checkoutUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            Square
                          </a>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
                        Link {shortId(row.id)}
                      </div>
                    </Cell>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'good' | 'watch' | 'bad' }) {
  const color = tone === 'bad' ? '#fecaca' : tone === 'watch' ? '#fde68a' : '#bbf7d0';
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        borderRadius: 14,
        padding: 16,
        background: 'rgba(14,13,12,.9)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8, color: '#f8fafc' }}>{value}</div>
      {sub ? <div style={{ marginTop: 2, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{sub}</div> : null}
    </div>
  );
}

function Cell({ children, head }: { children: ReactNode; head?: boolean }) {
  return (
    <div
      style={{
        padding: 12,
        minWidth: 0,
        color: head ? '#0f172a' : '#1e293b',
        fontSize: head ? 13 : 14,
      }}
    >
      {children}
    </div>
  );
}
