import { NextResponse } from 'next/server';

/**
 * Env required:
 *  - GAS_BASE  (your Apps Script Web App "latest" URL ending in /exec)
 *  - GAS_TOKEN (Script Property "API_TOKEN" if you set one; else leave blank)
 *
 * Your GAS must be deployed with "Who has access: Anyone" (or "Anyone with the link").
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GasRow = {
  tag?: string;
  confirmation?: string;
  customer?: string;

  // statuses
  status?: string;
  capingStatus?: string;
  webbsStatus?: string;
  specialtyStatus?: string;

  // pricing
  priceProcessing?: number;
  priceSpecialty?: number;
  price?: number;

  // paid
  Paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
};

function digits(s: string | undefined | null) {
  return String(s ?? '').replace(/\D+/g, '');
}

function pickBest(
  rows: GasRow[],
  q: { confirmation?: string; tag?: string; lastName?: string }
): GasRow | null {
  const wantConf = digits(q.confirmation);
  const wantTag = digits(q.tag);
  const wantLn = (q.lastName || '').trim().toLowerCase();

  if (wantConf) {
    const byConf = rows.find((r) => digits(r.confirmation) === wantConf);
    if (byConf) return byConf;
  }
  if (wantTag && wantLn) {
    const byTagName = rows.find(
      (r) =>
        digits(r.tag) === wantTag &&
        String(r.customer || '').toLowerCase().includes(wantLn)
    );
    if (byTagName) return byTagName;
  }
  // fallbacks
  if (wantTag) {
    const byTag = rows.find((r) => digits(r.tag) === wantTag);
    if (byTag) return byTag;
  }
  return rows[0] || null;
}

export async function POST(req: Request) {
  try {
    const { confirmation = '', tag = '', lastName = '' } = await req.json();

    const GAS_BASE = process.env.GAS_BASE || '';
    const GAS_TOKEN = (process.env.GAS_TOKEN || '').trim();

    if (!GAS_BASE) {
      return NextResponse.json(
        { ok: false, error: 'Missing GAS_BASE env var' },
        { status: 500 }
      );
    }

    // Build the query: prefer confirmation digits; otherwise use last name + tag
    const qDigits = digits(confirmation);
    const q =
      qDigits || !lastName
        ? qDigits
        : `${String(lastName || '').trim()} ${digits(tag)}`;

    // POST to GAS search
    const r = await fetch(GAS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // GAS getToken_ looks for token in body.token or URL param
      body: JSON.stringify({ action: 'search', q, token: GAS_TOKEN }),
      // Don't cache upstream at all
      cache: 'no-store',
    });

    // 503s usually mean wrong deployment or access denied on the GAS side.
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          error:
            r.status === 403
              ? 'Unauthorized to reach GAS (token or deployment access)'
              : `Upstream error (${r.status})${text ? `: ${text}` : ''}`,
        },
        { status: 502 }
      );
    }

    const data: { ok?: boolean; rows?: GasRow[] } = await r.json();

    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) {
      return NextResponse.json({ ok: false, notFound: true }, { status: 200 });
    }

    // Pick the best match
    const best = pickBest(rows, { confirmation, tag, lastName });
    if (!best) {
      return NextResponse.json({ ok: false, notFound: true }, { status: 200 });
    }

    // Normalize specialty so the page can always find it
    const tracks = {
      capeStatus: best.capingStatus || '',
      webbsStatus: best.webbsStatus || '',
      specialtyStatus: best.specialtyStatus || '',
    };

    // Normalize prices (prefer sheet values; GAS already computes fallbacks in search)
    const priceProcessing = Number(best.priceProcessing || 0) || undefined;
    const priceSpecialty = Number(best.priceSpecialty || 0) || undefined;
    const priceTotal =
      Number(best.price || 0) ||
      (priceProcessing || 0) + (priceSpecialty || 0) ||
      undefined;

    return NextResponse.json(
      {
        ok: true,
        tag: best.tag || '',
        confirmation: best.confirmation || '',
        customer: best.customer || '',
        status: best.status || '',
        tracks,
        priceProcessing,
        priceSpecialty,
        priceTotal,
        paid: !!best.Paid,
        paidProcessing: !!best.paidProcessing,
        paidSpecialty: !!best.paidSpecialty,
      },
      {
        // ensure no caching at the edge either
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
