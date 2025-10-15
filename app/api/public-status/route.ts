export const dynamic = 'force-dynamic';

type GasRow = {
  tag?: string;
  confirmation?: string;
  customer?: string;

  status?: string;
  capingStatus?: string;
  capeStatus?: string; // sometimes alias
  webbsStatus?: string;
  specialtyStatus?: string;

  priceProcessing?: number;
  priceSpecialty?: number;
  priceTotal?: number;

  Paid?: boolean;
  paid?: boolean;
  paidProcessing?: boolean;
  paidSpecialty?: boolean;
};

type SearchBody = {
  confirmation?: string;
  tag?: string;
  lastName?: string;
};

function env(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

const GAS_BASE = () => env('GAS_BASE');   // e.g. https://script.google.com/macros/s/AKfycb.../exec
const GAS_TOKEN = () => env('GAS_TOKEN'); // your Script Property token (optional but supported)

export async function POST(req: Request) {
  try {
    const { confirmation, tag, lastName } = (await req.json()) as SearchBody;

    if (!GAS_BASE()) {
      return Response.json({
        ok: false,
        error:
          'Missing GAS_BASE environment variable. Set this to your Apps Script web app URL.',
      });
    }

    // Build search query:
    // - Prefer confirmation (most exact)
    // - Else tag + lastName (space-separated, sheet search is bag-of-words)
    let q = '';
    if (confirmation && confirmation.trim()) {
      q = confirmation.trim();
    } else if (tag && lastName) {
      q = `${String(tag).trim()} ${String(lastName).trim()}`;
    } else if (tag) {
      q = String(tag).trim();
    }

    const url = new URL(GAS_BASE());
    url.searchParams.set('action', 'search');
    if (GAS_TOKEN()) url.searchParams.set('token', GAS_TOKEN());
    if (q) url.searchParams.set('q', q);

    const gasRes = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!gasRes.ok) {
      return Response.json({
        ok: false,
        error: `Upstream error (${gasRes.status})`,
      });
    }

    const data = (await gasRes.json()) as {
      ok?: boolean;
      rows?: GasRow[];
      error?: string;
    };

    if (!data?.ok) {
      return Response.json({
        ok: false,
        error: data?.error || 'Search failed',
      });
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];

    // Pick best match:
    //   - If confirmation supplied, exact match on confirmation if present
    //   - Else if tag supplied, exact match on tag (case-insensitive)
    //   - Else take the first row
    let hit: GasRow | undefined;

    if (confirmation) {
      const c = confirmation.trim().toLowerCase();
      hit = rows.find(
        (r) => String(r.confirmation || '').trim().toLowerCase() === c
      );
    }
    if (!hit && tag) {
      const t = String(tag).trim().toLowerCase();
      hit = rows.find((r) => String(r.tag || '').trim().toLowerCase() === t);
    }
    if (!hit) hit = rows[0];

    if (!hit) {
      return Response.json({ ok: false, notFound: true });
    }

    // Normalize statuses into a unified "tracks" block
    const cape = hit.capeStatus ?? hit.capingStatus;
    const webbs = hit.webbsStatus;
    const specialty = hit.specialtyStatus;

    const out = {
      ok: true,
      tag: hit.tag || '',
      confirmation: hit.confirmation || '',
      customer: hit.customer || '',

      // overall/meat status
      status: hit.status || '',

      // always provide tracks, even if some are empty
      tracks: {
        capeStatus: cape || '',
        webbsStatus: webbs || '',
        specialtyStatus: specialty || '',
      },

      // pricing
      priceProcessing:
        isFiniteNumber(hit.priceProcessing) ? Number(hit.priceProcessing) : undefined,
      priceSpecialty:
        isFiniteNumber(hit.priceSpecialty) ? Number(hit.priceSpecialty) : undefined,
      priceTotal:
        isFiniteNumber(hit.priceTotal) ? Number(hit.priceTotal) : undefined,

      // paid flags (normalize)
      paid:
        bool(hit.paid) || bool(hit.Paid) || (bool(hit.paidProcessing) && bool(hit.paidSpecialty)),
      paidProcessing: bool(hit.paidProcessing),
      paidSpecialty: bool(hit.paidSpecialty),
    };

    return Response.json(out);
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}

function isFiniteNumber(v: any): v is number {
  const n = Number(v);
  return typeof n === 'number' && isFinite(n);
}

function bool(v: any): boolean {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'paid', 'x', '✓', '✔', 'on'].includes(s);
}
