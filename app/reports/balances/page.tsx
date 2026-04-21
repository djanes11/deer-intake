import 'server-only';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getStaffProcessorContext, isPlatformAdmin } from '@/lib/staffContext';
import { formatDisplayDate } from '@/lib/dateFormat';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BalanceRow = {
  id: string;
  tag: string | null;
  confirmation: string | null;
  customer_name: string | null;
  phone: string | null;
  dropoff_date: string | null;
  status: string | null;
  specialty_status: string | null;
  specialty_products: boolean | null;
  price_processing: number | null;
  price_specialty: number | null;
  amount_paid_processing: number | null;
  amount_paid_specialty: number | null;
  paid_processing: boolean | null;
  paid_specialty: boolean | null;
  picked_up_processing: boolean | null;
};

function money(n: number | null | undefined) {
  return typeof n === 'number' ? `$${n.toFixed(2)}` : '$0.00';
}

function isReady(value: string | null | undefined) {
  const v = String(value || '').toLowerCase();
  return v === 'finished' || v === 'called';
}

function owedProcessing(row: BalanceRow) {
  return Math.max(0, (Number(row.price_processing ?? 0) || 0) - (Number(row.amount_paid_processing ?? 0) || 0));
}

function owedSpecialty(row: BalanceRow) {
  return row.specialty_products
    ? Math.max(0, (Number(row.price_specialty ?? 0) || 0) - (Number(row.amount_paid_specialty ?? 0) || 0))
    : 0;
}

function rowTotal(row: BalanceRow) {
  return owedProcessing(row) + owedSpecialty(row);
}

function cardStyle(accent: string): React.CSSProperties {
  return {
    border: `1px solid ${accent}`,
    borderRadius: 16,
    padding: 16,
    background: 'rgba(14,13,12,.88)',
  };
}

export default async function BalancesPage() {
  const processor = await getStaffProcessorContext();
  const platformAdmin = await isPlatformAdmin();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return (
      <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          Missing Supabase environment variables.
        </div>
      </main>
    );
  }

  if (!platformAdmin && processor.role !== 'admin') {
    return (
      <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Balances</h1>
          <div style={{ color: '#475569' }}>
            Processor admin access is required to review unpaid balances and ready-for-pickup balances.
          </div>
        </div>
      </main>
    );
  }

  if (!processor.id) {
    return (
      <main style={{ maxWidth: 1180, margin: '24px auto', padding: '0 16px 40px' }}>
        <div className="card" style={{ padding: 18, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Balances</h1>
          <div style={{ color: '#475569' }}>
            The current processor could not be resolved for this session, so balance reporting is not available yet.
          </div>
        </div>
      </main>
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('jobs')
    .select('id,tag,confirmation,customer_name,phone,dropoff_date,status,specialty_status,specialty_products,price_processing,price_specialty,amount_paid_processing,amount_paid_specialty,paid_processing,paid_specialty,picked_up_processing')
    .eq('processor_id', processor.id)
    .limit(3000);

  const rows = ((data || []) as BalanceRow[])
    .map((row) => ({
      ...row,
      price_processing: Number(row.price_processing ?? 0) || 0,
      price_specialty: Number(row.price_specialty ?? 0) || 0,
      amount_paid_processing: Number(row.amount_paid_processing ?? 0) || 0,
      amount_paid_specialty: Number(row.amount_paid_specialty ?? 0) || 0,
    }))
    .filter((row) => rowTotal(row) > 0);

  const readyUnpaid = rows
    .filter((row) => {
      const readyMeat = isReady(row.status) && !row.picked_up_processing && !row.paid_processing;
      const readySpecialty = !!row.specialty_products && isReady(row.specialty_status) && !row.paid_specialty;
      return readyMeat || readySpecialty;
    })
    .sort((a, b) => rowTotal(b) - rowTotal(a))
    .slice(0, 25);

  const largestBalances = [...rows]
    .sort((a, b) => rowTotal(b) - rowTotal(a))
    .slice(0, 25);

  const totals = {
    processing: rows.reduce((sum, row) => sum + owedProcessing(row), 0),
    specialty: rows.reduce((sum, row) => sum + owedSpecialty(row), 0),
    total: rows.reduce((sum, row) => sum + rowTotal(row), 0),
    readyTotal: readyUnpaid.reduce((sum, row) => sum + rowTotal(row), 0),
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
          Processor Admin
        </div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 30, lineHeight: 1.05 }}>Balances</h1>
        <div style={{ color: 'rgba(248,250,252,.88)', maxWidth: 780, lineHeight: 1.5 }}>
          Use this page to see who still owes money, which ready-for-pickup orders still need collected, and where the biggest unpaid balances are sitting.
        </div>
      </section>

      {error ? (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 800 }}>
          {String(error.message || error)}
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={cardStyle('rgba(200,138,61,.18)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Open Processing</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{money(totals.processing)}</div>
        </div>
        <div style={cardStyle('rgba(200,138,61,.18)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Open Specialty</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{money(totals.specialty)}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Total Open Balance</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{money(totals.total)}</div>
        </div>
        <div style={cardStyle('rgba(88,141,102,.22)')}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#b7a98d' }}>Ready for Pickup & Unpaid</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>{money(totals.readyTotal)}</div>
          <div style={{ marginTop: 4, color: '#b7a98d', fontSize: 13, fontWeight: 700 }}>{readyUnpaid.length} orders</div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Ready for Pickup & Unpaid</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              Orders that are ready for pickup but still need money collected.
            </div>
          </div>
          {!readyUnpaid.length ? (
            <div style={{ padding: 16, color: '#64748b' }}>No ready-for-pickup unpaid orders right now. Once an order is finished and still has money due, it will show here for pickup collection.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {readyUnpaid.map((row, idx) => (
                <BalanceListRow key={`ready-${row.id}`} row={row} idx={idx} />
              ))}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid #d6dee8', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 900, color: '#0f172a' }}>Largest Open Balances</div>
            <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
              The largest unpaid orders across processing and specialty work.
            </div>
          </div>
          {!largestBalances.length ? (
            <div style={{ padding: 16, color: '#64748b' }}>No open balances right now. New unpaid processing or specialty balances will show here automatically.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {largestBalances.map((row, idx) => (
                <BalanceListRow key={`balance-${row.id}`} row={row} idx={idx} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function BalanceListRow({ row, idx }: { row: BalanceRow; idx: number }) {
  const processing = owedProcessing(row);
  const specialty = owedSpecialty(row);
  const total = rowTotal(row);

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gap: 8,
        borderTop: idx === 0 ? '0' : '1px solid #eef2f7',
        background: idx % 2 ? '#fbfdff' : '#ffffff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontWeight: 900, color: '#0f172a' }}>
            {row.customer_name || 'Unknown customer'}
            {row.tag ? <span style={{ marginLeft: 8, color: '#9a3412', fontWeight: 800 }}>Tag {row.tag}</span> : null}
          </div>
          <div style={{ fontSize: 14, color: '#475569' }}>
            Confirmation {row.confirmation || '-'}
            {row.phone ? ` | ${row.phone}` : ''}
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 950, color: '#166534' }}>{money(total)}</div>
          {row.tag ? (
            <Link href={`/intake/${encodeURIComponent(row.tag)}`} style={{ fontSize: 13, fontWeight: 800 }}>
              Open Intake
            </Link>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13 }}>
        <span>Drop-off: {formatDisplayDate(row.dropoff_date)}</span>
        <span>Meat: {processing > 0 ? `${money(processing)} unpaid` : 'Paid'}</span>
        <span>Specialty: {specialty > 0 ? `${money(specialty)} unpaid` : row.specialty_products ? 'Paid' : 'None'}</span>
        <span>Meat status: {row.status || '-'}</span>
        <span>Specialty status: {row.specialty_products ? row.specialty_status || '-' : 'None'}</span>
      </div>
    </div>
  );
}

