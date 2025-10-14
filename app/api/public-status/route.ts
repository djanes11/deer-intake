export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';

const RAW_GAS_BASE =
  (process.env.GAS_BASE || process.env.NEXT_PUBLIC_GAS_BASE || '').trim().replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = (process.env.GAS_TOKEN || process.env.EMAIL_SIGNING_SECRET || '').trim();

function assertGas() {
  if (!RAW_GAS_BASE) throw new Error('GAS_BASE is not configured.');
  // throws if invalid
  new URL(RAW_GAS_BASE);
}

function asBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'paid', 'paid-in-full'].includes(s);
}

function toMoney(v: any): number | undefined {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function pick(obj: Record<string, any> | undefined, keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const confirmation = String(body?.confirmation || '').trim();
    const tag = String(body?.tag || '').trim();
    const lastName = String(body?.lastName || '').trim();

    if (!confirmation && !(tag && lastName)) {
      return Response.json({ ok: false, error: 'Provide Confirmation # — or Tag + Last Name.' }, { status: 400 });
    }

    assertGas();
    const url = new URL(RAW_GAS_BASE);
    // Keep your existing Apps Script behavior; just pass through inputs.
    // Prefer a generic "publicStatus" action if your script supports it.
    url.searchParams.set('action', 'publicStatus');
    if (confirmation) url.searchParams.set('confirmation', confirmation);
    if (tag) url.searchParams.set('tag', tag);
    if (lastName) url.searchParams.set('lastName', lastName);
    if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);

    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) {
      return Response.json({ ok: false, error: `Upstream error: ${r.status}` }, { status: 502 });
    }
    const data = await r.json();

    // The script may already return the shape we need. Normalize defensively.
    const job: Record<string, any> | undefined =
      data?.job || data?.result?.job || data?.result || data?.record || undefined;

    if (!data?.ok && !job) {
      return Response.json({ ok: false, notFound: true }, { status: 200 });
    }

    // Extract statuses (keep existing keys you already send)
    const status =
      pick(job, ['status', 'Status']) ?? data?.status ?? data?.result?.status ?? '';

    const tracks = {
      webbsStatus: pick(job, ['webbsStatus', 'Webbs Status', 'webbs_status']),
      specialtyStatus: pick(job, ['specialtyStatus', 'Specialty Status', 'specialty_status']),
      capeStatus: pick(job, ['capingStatus', 'Caping Status', 'Cape Status', 'capeStatus']),
    };

    // ---------- NEW: payment normalization ----------
    const paidRaw =
      pick(job, ['paid', 'Paid', 'paymentReceived', 'Payment Received', 'paidInFull', 'Paid In Full', 'paymentStatus']) ??
      undefined;

    const totalDue = toMoney(
      pick(job, ['totalDue', 'Total Due', 'total', 'Total', 'amountDue', 'Amount Due'])
    );
    const amountPaid = toMoney(
      pick(job, ['amountPaid', 'Amount Paid', 'paidAmount', 'Paid Amount'])
    );
    const balanceDue =
      toMoney(pick(job, ['balanceDue', 'Balance Due', 'balance', 'Balance'])) ??
      (totalDue !== undefined && amountPaid !== undefined ? Math.max(0, totalDue - amountPaid) : undefined);

    const payment = {
      paid: paidRaw !== undefined ? asBool(paidRaw) : (balanceDue === 0 && totalDue !== undefined),
      amountPaid,
      totalDue,
      balanceDue,
      display:
        totalDue !== undefined || amountPaid !== undefined || balanceDue !== undefined
          ? [
              totalDue !== undefined ? `Total $${totalDue.toFixed(2)}` : null,
              amountPaid !== undefined ? `Paid $${amountPaid.toFixed(2)}` : null,
              balanceDue !== undefined ? `Balance $${balanceDue.toFixed(2)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined,
    };

    return Response.json(
      {
        ok: true,
        tag: pick(job, ['tag', 'Tag']) ?? data?.tag,
        confirmation: pick(job, ['confirmation', 'Confirmation']) ?? data?.confirmation,
        status,
        tracks,
        payment,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

