// app/api/public-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GasRow = {
  tag?: string;
  confirmation?: string;
  customer?: string;
  status?: string;
  capingStatus?: string;
  webbsStatus?: string;
  specialtyStatus?: string;

  // pricing from GAS
  priceProcessing?: number;
  priceSpecialty?: number;
  priceTotal?: number;

  // paid flags from GAS
  Paid?: boolean; // sometimes capitalized
  paid?: boolean; // alias
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
};

type GasSearchResp = { ok?: boolean; rows?: GasRow[]; error?: string };

function envTrim(v?: string | null) {
  return String(v ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function getGasBase(): string {
  const raw =
    envTrim(process.env.GAS_BASE) ||
    envTrim(process.env.NEXT_PUBLIC_GAS_BASE) ||
    '';
  if (!raw) throw new Error('GAS_BASE (or NEXT_PUBLIC_GAS_BASE) is not set.');
  // will throw if invalid
  new URL(raw);
  return raw;
}

function getGasToken(): string {
  return (
    envTrim(process.env.GAS_TOKEN) ||
    envTrim(process.env.API_TOKEN) ||
    envTrim(process.env.EMAIL_SIGNING_SECRET) ||
    ''
  );
}

function digits(s?: string) {
  return String(s || '').replace(/\D+/g, '');
}

function lastNameOnly(s?: string) {
  const t = String(s || '').trim();
  if (!t) return '';
  const parts = t.split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

function normalizeBool(v: any): boolean {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'paid', 'x', '✓', '✔', 'on'].includes(s);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const confirmation = String(body?.confirmation ?? '').trim();
    const tag = String(body?.tag ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();

    // Build the search query for GAS
    let query = '';
    let mode: 'confirmation' | 'tag+name' | '' = '';
    if (confirmation) {
      query = confirmation;
      mode = 'confirmation';
    } else if (tag && lastName) {
      query = `${tag} ${lastName}`;
      mode = 'tag+name';
    } else {
      return NextResponse.json(
        { ok: false, error: 'Provide Confirmation # OR Tag + Last Name.' },
        { status: 400 }
      );
    }

    // Call GAS search
    const base = getGasBase();
    const url = new URL(base);
    url.searchParams.set('action', 'search');
    url.searchParams.set('q', query);
    const tok = getGasToken();
    if (tok) url.searchParams.set('token', tok);

    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `GAS search failed: HTTP ${r.status}` },
        { status: 502 }
      );
    }
    const data = (await r.json()) as GasSearchResp;
    if (!data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || 'GAS returned an error' },
        { status: 502 }
      );
    }

    const rows = data.rows || [];
    if (!rows.length) {
      return NextResponse.json({ ok: false, notFound: true });
    }

    // Pick the best match
    const pick = (() => {
      if (mode === 'confirmation') {
        const want = digits(confirmation);
        // Strongest match: confirmation digits exact (fallback to first row)
        const exact = rows.find((row) => digits(row.confirmation) === want);
        return exact || rows[0];
      } else {
        const wantTag = tag.toLowerCase();
        const wantLast = lastName.toLowerCase();
        // Prefer exact tag & last name match
        const exact = rows.find((row) => {
          const t = String(row.tag || '').toLowerCase();
          const ln = lastNameOnly(row.customer);
          return t === wantTag && ln === wantLast;
        });
        if (exact) return exact;
        // Fallback: tag only
        const tagOnly = rows.find(
          (row) => String(row.tag || '').toLowerCase() === wantTag
        );
        return tagOnly || rows[0];
      }
    })();

    if (!pick) {
      return NextResponse.json({ ok: false, notFound: true });
    }

    // Map fields the Status page expects
    const paidAll = normalizeBool(pick.Paid ?? pick.paid);
    const paidProcessing = normalizeBool(pick.paidProcessing);
    const paidSpecialty = normalizeBool(pick.paidSpecialty);

    const priceProcessing =
      typeof pick.priceProcessing === 'number'
        ? pick.priceProcessing
        : undefined;
    const priceSpecialty =
      typeof pick.priceSpecialty === 'number' ? pick.priceSpecialty : undefined;
    const priceTotal =
      typeof pick.priceTotal === 'number' ? pick.priceTotal : undefined;

    return NextResponse.json({
      ok: true,
      tag: pick.tag || '',
      confirmation: pick.confirmation || '',
      status: pick.status || '',
      tracks: {
        webbsStatus: pick.webbsStatus || '',
        specialtyStatus: pick.specialtyStatus || '',
        capeStatus: pick.capingStatus || '',
      },

      // Pricing
      priceProcessing,
      priceSpecialty,
      priceTotal,

      // Paid flags
      paid: paidAll,
      paidProcessing,
      paidSpecialty,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

// Optional: allow simple GET forwarding (useful for quick tests)
export async function GET(req: NextRequest) {
  // Encourage POST, but support GET ?confirmation=... or ?tag=...&lastName=...
  const u = new URL(req.url);
  const confirmation = u.searchParams.get('confirmation') || '';
  const tag = u.searchParams.get('tag') || '';
  const lastName = u.searchParams.get('lastName') || '';
  return POST(
    new NextRequest(req.url, {
      method: 'POST',
      body: JSON.stringify({ confirmation, tag, lastName }),
      headers: { 'Content-Type': 'application/json' },
    })
  );
}
