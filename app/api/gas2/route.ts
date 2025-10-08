// app/api/gas2/route.ts
// Initial email on first save (signed read-only link).
// Finished email once when status first becomes Finished/Ready (save OR progress).
// Robust @needsTag search; NO auto-generation of confirmation numbers.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

// === Added for job fetch (safe, non-breaking) ===
const SHEET_HEADERS = [
  "Tag","Confirmation #","Customer","Phone","Email","Address","City","State","Zip","County Killed","Sex","Process Type","Drop-off Date","Status","Caping Status","Webbs Status","Steak","Steak Size (Other)","Burger Size","Steaks per Package","Beef Fat","Hind Roast Count","Front Roast Count","Backstrap Prep","Backstrap Thickness","Backstrap Thickness (Other)","Notes","Webbs Order","Webbs Order Form Number","Webbs Pounds","Price","Paid","Specialty Products","Specialty Pounds","Summer Sausage (lb)","Summer Sausage + Cheese (lb)","Sliced Jerky (lb)","Hind - Steak","Hind - Roast","Hind - Grind","Hind - None","Front - Steak","Front - Roast","Front - Grind","Front - None","Notified Ready At","Public Token","Public Link Sent At","Drop-off Email Sent At","Processing Price","Specialty Price","Paid Processing","Paid Processing At","Paid Specialty","Paid Specialty At","Picked Up - Processing","Picked Up - Processing At","Picked Up - Cape","Picked Up - Cape At","Picked Up - Webbs","Picked Up - Webbs At","Call Attempts","Last Called At","Last Called By","Last Call Outcome","Last Call At","Call Notes","Meat Attempts","Cape Attempts","Webbs Attempts","Requires Tag","Phone Last4",
  "Specialty Status",
  "Pref Email",
  "Pref SMS",
  "Pref Call",
  "SMS Consent",
  "Auto Call Consent"];

// --- canonical key mapping (space/no-space/camel/underscored -> real header) ---
const toKey = (s: string) =>
  s?.toString()?.normalize('NFKC').toLowerCase().replace(/[^a-z]/g, '') || '';

const headerKeyIndex: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const h of SHEET_HEADERS) m[toKey(h)] = h;
  // frequent aliases we’ve seen in your payloads
  Object.assign(m, {
    customer: 'Customer', customername: 'Customer', name: 'Customer', cust: 'Customer',
    steaksize: 'Steak',
    steaksperpkg: 'Steaks per Package', steaksperpackage: 'Steaks per Package',
    burgersize: 'Burger Size',
    backstrapprep: 'Backstrap Prep',
    backstrapthickness: 'Backstrap Thickness',
    backstrapthicknessother: 'Backstrap Thickness (Other)',
    steaksizeother: 'Steak Size (Other)',
    specialtypounds: 'Specialty Pounds',
    webbsorder: 'Webbs Order',
    webbsorderformnumber: 'Webbs Order Form Number',
    webbspounds: 'Webbs Pounds',
    hindsteak: 'Hind - Steak', hindroast: 'Hind - Roast', hindgrind: 'Hind - Grind', hindnone: 'Hind - None',
    frontsteak: 'Front - Steak', frontroast: 'Front - Roast', frontgrind: 'Front - Grind', frontnone: 'Front - None',
  
    specialtystatus: 'Specialty Status',
    prefemail: 'Pref Email',
    prefsms: 'Pref SMS',
    prefcall: 'Pref Call',
    smsconsent: 'SMS Consent',
    autocallconsent: 'Auto Call Consent',});
  return m;
})();

function canonizeDict(d: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d || {})) {
    const canon = headerKeyIndex[toKey(k)];
    if (canon) out[canon] = v;
  }
  // ensure Customer if present under any common variant
  if (!('Customer' in out)) {
    out['Customer'] =
      d['Customer'] ??
      d['Customer Name'] ??
      (d as any).CustomerName ??
      (d as any).customerName ??
      (d as any).customer_name ??
      (d as any).name ??
      (d as any).customer ??
      '';
  }
  return out;
}

function fromArrays(headers: string[], rows: any[]): Record<string, any>[] {
  return rows.map((arr: any[]) =>
    Object.fromEntries(headers.map((h, i) => [h, arr?.[i] ?? ""]))
  );
}

// This now FLATTENS and CANONIZES to sheet headers.
function normalizeRows(payload: any): Record<string, any>[] {
  if (!payload) return [];

  // array of dicts
  if (Array.isArray(payload) && payload.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
    return (payload as any[]).map(canonizeDict);
  }

  // { rows, headers? } or { items }
  if (payload.rows && Array.isArray(payload.rows)) {
    const rows = payload.rows;
    const headers: string[] = Array.isArray(payload.headers) && payload.headers.length ? payload.headers : SHEET_HEADERS;
    if (rows.length && Array.isArray(rows[0])) {
      return fromArrays(headers, rows).map(canonizeDict);
    }
    if (rows.length && typeof rows[0] === 'object') return rows.map(canonizeDict);
  }
  if (payload.items && Array.isArray(payload.items)) {
    const items = payload.items;
    if (items.length && Array.isArray(items[0])) return fromArrays(SHEET_HEADERS, items).map(canonizeDict);
    return items.map(canonizeDict);
  }

  // array-of-arrays
  if (Array.isArray(payload) && payload.length && Array.isArray(payload[0])) {
    return fromArrays(SHEET_HEADERS, payload).map(canonizeDict);
  }

  // single dict fallback
  if (typeof payload === 'object') return [canonizeDict(payload)];

  return [];
}

type AnyRec = Record<string, any>;

const GAS_BASE = (process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE || '')
  .trim()
  .replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = process.env.GAS_TOKEN || '';
const SITE = process.env.SITE_NAME || 'McAfee Custom Deer Processing';
const EMAIL_DEBUG = process.env.EMAIL_DEBUG === '1';

const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '•') : '');
const log = (...args: any[]) => console.log('[gas2]', ...args);

function logEnvOnce() {
  // @ts-ignore
  if ((globalThis as any).__envLogged) return;
  // @ts-ignore
  (globalThis as any).__envLogged = true;
  log(
    'runtime=nodejs, GAS_BASE:',
    GAS_BASE ? '[set]' : '[missing]',
    'SMTP_USER:',
    mask(process.env.SMTP_USER || ''),
    'RESEND:',
    !!process.env.RESEND_API_KEY ? 'on' : 'off'
  );
}

/* ---------------- Pricing helpers ---------------- */
function normProc(s: any): string {
  const v = String(s || '').toLowerCase();
  if (v.includes('donate') && v.includes('cape')) return 'Cape & Donate';
  if (v.includes('donate')) return 'Donate';
  if (v.includes('cape') && !v.includes('skull')) return 'Caped';
  if (v.includes('skull')) return 'Skull-Cap';
  if (v.includes('euro')) return 'European';
  if (v.includes('standard')) return 'Standard Processing';
  return '';
}
function processingPrice(proc: any, beef: boolean, webbs: boolean) {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 :
    p === 'Cape & Donate' ? 50 :
    ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 :
    p === 'Donate' ? 0 : 0;
  return base ? base + (beef ? 5 : 0) + (webbs ? 20 : 0) : 0;
}
const isFinished = (s?: string) => {
  const v = String(s || '').toLowerCase();
  return v.includes('finish') || v.includes('ready') || v === 'finished';
};

/* ---------------- GAS helpers ---------------- */
async function gasGet(tag: string) {
  const url = new URL(GAS_BASE!);
  url.searchParams.set('action', 'get');
  url.searchParams.set('tag', tag);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), { cache: 'no-store' });
  return r.json();
}
async function gasPost(body: AnyRec) {
  const url = new URL(GAS_BASE!);
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try {
    return { status: r.status, json: JSON.parse(text) as AnyRec, text: undefined as string | undefined };
  } catch {
    return { status: r.status, text, json: undefined as AnyRec | undefined };
  }
}

/* ---------------- Site origin + signed link ---------------- */
function getSiteOrigin(req: Request) {
  const env = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}
function hmac16(tag: string) {
  if (!GAS_TOKEN) return '';
  return crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0, 16);
}
function formViewUrl(req: Request, tag: string) {
  const origin = getSiteOrigin(req);
  const t = hmac16(tag);
  const url = new URL(`${origin}/intake/${encodeURIComponent(tag)}`);
  if (t) url.searchParams.set('t', t);
  return url.toString();
}

/* ---------------- Utils ---------------- */
function truthyBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'on', '✓', '✔'].includes(s);
}
function getTagFromRow(r: AnyRec): string {
  const keys = ['tag','Tag','TAG','Tag Number','tag_number','TagNumber','Deer Tag'];
  for (const k of keys) if (r[k] != null) return String(r[k]).trim();
  return '';
}
function getConfirmationFromRow(r: AnyRec): string {
  const k = ['confirmation','Confirmation #','Confirmation','Confirm #','confirm','CONFIRMATION'];
  for (const key of k) if (r[key] != null) return String(r[key]).trim();
  return '';
}

/* ---------------- Handlers ---------------- */
export async function GET(req: NextRequest) {
  logEnvOnce();
  if (!GAS_BASE) {
    return new Response(JSON.stringify({ ok: false, error: 'GAS_BASE missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const url = new URL(GAS_BASE!);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  if (!url.searchParams.get('action') && !url.searchParams.get('endpoint'))
    url.searchParams.set('action', 'ping');
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);

  const upstream = await fetch(url.toString(), { cache: 'no-store' });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  logEnvOnce();
  if (!GAS_BASE) {
    log('fatal: GAS_BASE missing');
    return new Response(
      JSON.stringify({ ok: false, error: 'Server misconfigured: GAS_BASE missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as AnyRec;
  const action =
    String(body.action || body.endpoint || '').trim().toLowerCase() || (body.job ? 'save' : '');

  // === NEW: job action: return full flat row keyed by sheet headers ===
  if (action === 'job') {
    const tag = String(body?.tag ?? '').trim();
    if (!tag) return Response.json({ ok: false, error: 'missing tag' }, { status: 400 });

    // 1) Prefer your existing full-row GET
    try {
      const got = await gasGet(tag);
      const rows1 = normalizeRows(got?.job ?? got);
      const row1 =
        rows1.find((r: any) => toKey(String(getTagFromRow(r))) === toKey(tag)) ||
        rows1[0] || null;
      if (row1) {
        const job = { Tag: tag, ...row1 };
        return Response.json({ ok: true, job }, { status: 200 });
      }
    } catch {}

    // 2) Fallback: search
    try {
      const up = await gasPost({ action: 'search', q: tag, query: tag });
      if (up.status < 400) {
        const rows2 = normalizeRows(up.json?.rows ?? up.json?.results ?? up.json ?? []);
        const row2 =
          rows2.find((r: any) => toKey(String(getTagFromRow(r))) === toKey(tag)) ||
          rows2[0] || null;
        if (row2) {
          const job = { Tag: tag, ...row2 };
          return Response.json({ ok: true, job }, { status: 200 });
        }
      }
    } catch {}

    return Response.json({ ok: true, job: { Tag: tag }, exists: false }, { status: 200 });
  }

  log('POST action=', action);

  /* ---------- SIGNED VIEW LINK ---------- */
  if (action === 'viewlink') {
    const tag = String(body.tag || '').trim();
    if (!tag) {
      return new Response(JSON.stringify({ ok:false, error:'Missing tag' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const url = formViewUrl(req, tag);
    return new Response(JSON.stringify({ ok:true, url }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  /* ---------- SET TAG (from Overnight Review) ---------- */
  if (action === 'settag') {
    const row = Number(body.row || 0) | 0;
    const tag = String(body.tag || '').trim();
    if (!row || !tag) {
      return new Response(JSON.stringify({ ok:false, error:'Missing row or tag' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1) write tag and ask GAS to give us row details (email/name/stamp state)
    const up = await gasPost({ action:'setTag', row, tag, returnRow: true });
    if (up.status >= 400 || (up.json && up.json.ok === false)) {
      return new Response(
        up.text || JSON.stringify(up.json || { ok:false, error:'setTag failed' }),
        { status: up.status, headers: { 'Content-Type': up.text ? 'text/plain' : 'application/json' } }
      );
    }

    const info = up.json || {};
    const email = String(info.email || '').trim();
    const name  = String(info.name  || '').trim();
    const alreadyStamped = !!info.dropEmailStamped;

    let emailAttempted = false;
    let emailError: string | undefined;

    // 2) send once if we have an email and it hasn't been stamped yet
    if (email && !alreadyStamped) {
      try {
        const viewUrl = formViewUrl(req, tag);
        await sendEmail({
          to: email,
          subject: `${SITE} — Intake Confirmation (Tag ${tag})`,
          html: [
            `<p>Hi ${name || 'there'},</p>`,
            `<p>We received your deer (Tag <b>${tag}</b>).</p>`,
            `<p><a href="${viewUrl}" target="_blank" rel="noopener">Click here to view your intake form</a> (read-only).</p>`,
            `<p>If you need to make any updates or have questions, please contact Travis at <a href="tel:15026433916">(502) 643-3916</a>.</p>`,
            `<p>— ${SITE}</p>`,
          ].join('')
        });
        emailAttempted = true;

        // 3) ask GAS to stamp so we don’t re-send
        try {
          await gasPost({ action:'setTag', row, tag, stampDropEmail: true });
        } catch {}
      } catch (e:any) {
        emailAttempted = true;
        emailError = String(e?.message || e);
        if (EMAIL_DEBUG) {
          return new Response(JSON.stringify({ ok:true, warning:'email_failed', error: emailError }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok:true, emailAttempted, email, alreadyStamped, emailError }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  /* ---------- SPECIAL: mark picked up (any track) & flip track status ---------- */
  if (action === 'pickedup') {
    const tag = String(body.tag || '').trim();
    const scopeRaw = String(body.scope || 'meat').toLowerCase();
    const scope = scopeRaw === 'webbs' ? 'webbs' : scopeRaw === 'cape' ? 'cape' : 'meat';

    if (!tag) {
      return new Response(JSON.stringify({ ok:false, error:'Missing tag' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date().toISOString();

    // IMPORTANT:
    // GAS saveJob() writes the *lower-case* fields:
    //   - status          -> Status column
    //   - capingStatus    -> Caping Status column
    //   - webbsStatus     -> Webbs Status column
    // So set those exact keys to flip the visible columns to "Picked Up".
    const updates: AnyRec = { tag };
    if (scope === 'meat') {
      updates.status = 'Picked Up';
      // (optional flags below are ignored by saveJob(), but harmless)
      updates['Picked Up - Processing'] = true;
      updates['Picked Up - Processing At'] = now;
    } else if (scope === 'cape') {
      updates.capingStatus = 'Picked Up';
      updates['Picked Up - Cape'] = true;
      updates['Picked Up - Cape At'] = now;
    } else {
      updates.webbsStatus = 'Picked Up';
      updates['Picked Up - Webbs'] = true;
      updates['Picked Up - Webbs At'] = now;
    }

    const res = await gasPost({ action: 'save', job: updates });
    if (res.status >= 400 || (res.json && res.json.ok === false)) {
      return new Response(
        res.text || JSON.stringify(res.json || { ok:false, error:'pickedUp failed' }),
        { status: res.status, headers: { 'Content-Type': res.text ? 'text/plain' : 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ ok:true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  /* ---------- SPECIAL SEARCH: needsTag ---------- */
  const wantsNeedsTag =
    action === 'needstag' ||
    (action === 'search' && String(body.q || '').trim().toLowerCase() === '@needstag');

  if (wantsNeedsTag) {
    const attempts: AnyRec[] = [
      { action: 'search', q: '@needsTag', limit: body.limit || 500 },
      { action: 'search', q: '',          limit: body.limit || 500 },
      { action: 'search', q: '@all',      limit: body.limit || 500 },
      { action: 'search', q: '@recent',   limit: body.limit || 500 },
    ];

    let all: AnyRec[] = [];
    for (const payload of attempts) {
      const up = await gasPost(payload);
      if (up.status >= 400) continue;
      const rows = (up.json?.rows || up.json?.results || up.json || []) as AnyRec[];
      if (Array.isArray(rows) && rows.length) { all = rows; break; }
    }

    if (!all.length) {
      return new Response(JSON.stringify({ ok: true, rows: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const filtered = all.filter((r) => {
      const tag = getTagFromRow(r);
      const req = truthyBool(r.requiresTag ?? r['Requires Tag'] ?? r.requires_tag);
      return !tag || req;
    });

    const normalized = filtered.map((r) => ({
      ...r,
      confirmation: getConfirmationFromRow(r),
      tag: getTagFromRow(r),
      customer: r.customer ?? r['Customer Name'] ?? r.Customer ?? r.name ?? '',
      phone: r.phone ?? r.Phone ?? '',
      dropoff: r.dropoff ?? r['Drop-off'] ?? r['Drop Off'] ?? r['Drop-off Date'] ?? r['Drop Off Date'] ?? r['Date Dropped'] ?? '',
      row: r.row ?? r.Row ?? r._row ?? r._index ?? undefined,
    }));

    const seen = new Set<string>();
    const rowsOut = normalized.filter((r) => {
      const key = String(r.row ?? JSON.stringify([r.customer, r.phone, r.dropoff]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new Response(JSON.stringify({ ok: true, rows: rowsOut }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Tag-centric actions we enrich (save/progress); others pass through
  const tag = String((body.job && body.job.tag) || body.tag || '').trim();
  const isTagAction = ['save', 'progress'].includes(action);

  // ----- Overnight save without tag allowed -----
  const requiresTag =
    action === 'save' &&
    (body?.job?.requiresTag === true ||
      String(body?.job?.requiresTag || '').toLowerCase() === 'true');

  const isOvernight = action === 'save' && requiresTag && tag === '';

  if (isOvernight) {
    const j = { ...(body.job || {}) };
    const conf =
      j.confirmation ??
      j['Confirmation #'] ??
      j['Confirmation'] ??
      j['Confirm #'] ??
      j.confirm ??
      '';
    if (conf) {
      j.confirmation = conf;
      j['Confirmation #'] = conf;
    }
    const payload = { action: 'save', job: { ...j, tag: '', requiresTag: true } };
    const forwarded = await gasPost(payload);
    if (forwarded.status >= 400) {
      log('overnight save upstream error:', forwarded.status, forwarded.text || forwarded.json);
      return new Response(
        forwarded.text || JSON.stringify(forwarded.json || { ok: false, error: 'save failed' }),
        {
          status: forwarded.status,
          headers: { 'Content-Type': forwarded.text ? 'text/plain' : 'application/json' },
        }
      );
    }
    return new Response(
      forwarded.text || JSON.stringify(forwarded.json || { ok: true }),
      { status: 200, headers: { 'Content-Type': forwarded.text ? 'text/plain' : 'application/json' } }
    );
  }

  if (!isTagAction) {
    const res = await gasPost(body);
    return new Response(res.text || JSON.stringify(res.json || {}), {
      status: res.status,
      headers: { 'Content-Type': res.text ? 'text/plain' : 'application/json' },
    });
  }

  // For normal save/progress we still require a tag.
  if (!tag) {
    log('skip: missing tag');
    return new Response(JSON.stringify({ ok: false, error: 'Missing job.tag or tag' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // BEFORE
  const prevRes = await gasGet(tag).catch((e) => {
    log('gasGet prev error', e?.message || e);
    return null;
  });
  const prevExists = !!(prevRes && prevRes.exists && prevRes.job);
  const prev = prevExists ? (prevRes!.job as AnyRec) : null;

  // *** AUTO-ADVANCE for bare progress(tag) ***
  if (
    action === 'progress' &&
    tag &&
    !body.job &&
    !body.status &&
    !body.capingStatus &&
    !body.webbsStatus
  ) {
    const s = String(prev?.status || '').toLowerCase();
    let nextStatus: string | null = null;
    if (!s || /(drop|received|intake|new)/.test(s)) nextStatus = 'Processing';
    else if (/process/.test(s) && !/finish|ready|finished|complete/.test(s)) nextStatus = 'Finished';

    (body as any).nextStatus = nextStatus;

    if (nextStatus) {
      body.status = nextStatus;
      body.tag = tag;
      body.action = 'save';
      body.job = { ...(prev || {}), tag, status: nextStatus };
    }
  }

  // FORWARD to GAS (save or progress)
  const forwarded = await gasPost(body);
  if (forwarded.status >= 400) {
    return new Response(
      forwarded.text || JSON.stringify(forwarded.json || { ok: false, error: `${action} failed` }),
      { status: forwarded.status, headers: { 'Content-Type': forwarded.text ? 'text/plain' : 'application/json' } }
    );
  }
  if (!forwarded.json || forwarded.json.ok === false) {
    return new Response(JSON.stringify(forwarded.json || { ok: false, error: `${action} failed` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // AFTER
  const latestRes = await gasGet(tag).catch(() => null);
  const latest = latestRes && latestRes.job ? (latestRes.job as AnyRec) : (body.job || {});

  let nextStatusEcho: string | null =
    (body as any).nextStatus ?? (forwarded.json && forwarded.json.nextStatus) ?? null;
  const prevS = String(prev?.status || '').trim();
  const latestS = String(latest?.status || '').trim();
  if (latestS && latestS !== prevS) nextStatusEcho = latestS;

  const shouldInitial = action === 'save' && !prevExists;
  const finishedNow = isFinished(latest?.status);
  const finishedBefore = isFinished(prev?.status);
  const shouldFinished = finishedNow && !finishedBefore;

  const customerEmail = String(latest.email || (body.job && body.job.email) || '').trim();
  const custName = String(latest.customer || latest['Customer Name'] || '').trim();

  if (customerEmail) {
    try {
      if (shouldInitial) {
        const viewUrl = formViewUrl(req, tag);
        await sendEmail({
          to: customerEmail,
          subject: `${SITE} — Intake Confirmation (Tag ${tag})`,
          html: [
            `<p>Hi ${custName || 'there'},</p>`,
            `<p>We received your deer (Tag <b>${tag}</b>).</p>`,
            `<p><a href="${viewUrl}" target="_blank" rel="noopener">Click here to view your intake form</a> (read-only).</p>`,
            `<p>If you need to make any updates or have questions, please contact Travis at <a href="tel:15026433916">(502) 643-3916</a>.</p>`,
            `<p>— ${SITE}</p>`,
          ].join(''),
        });
      }
      if (shouldFinished) {
        const procPrice = processingPrice(
          latest.processType,
          !!latest.beefFat,
          !!latest.webbsOrder
        );
        const paidProcessing = !!(latest.paidProcessing || latest['Paid Processing']);
        const stillOwe = paidProcessing ? 0 : Math.max(0, procPrice);
        const owedBlock =
          stillOwe > 0 ? `<p><b>Amount still owed (regular processing): $${stillOwe.toFixed(2)}</b></p>` : '';

        await sendEmail({
          to: customerEmail,
          subject: `${SITE} — Finished & Ready (Tag ${tag})`,
          html: [
            `<p>Hi ${custName || 'there'},</p>`,
            `<p>Your regular processing is finished and ready for pickup.</p>`,
            owedBlock,
            `<p><b>Pickup hours</b>: 6:00 pm–8:00 pm Monday–Friday, 9:00 am–5:00 pm Saturday, 9:00 am-12:00pm Sunday.</p>`,
            `<p>Please contact Travis at <a href="tel:15026433916">(502) 643-3916</a> to confirm your pickup time or ask any questions.</p>`,
            `<p>Please bring a cooler or box to transport your meat.</p>`,
            `<p><em>Reminder:</em> This update is for your regular processing only. We’ll reach out separately about any Webbs orders or McAfee Specialty Products.</p>`,
            `<p>— ${SITE}</p>`,
          ].join(''),
        });
      }
    } catch (e: any) {
      if (EMAIL_DEBUG) {
        return new Response(
          JSON.stringify({ ok: true, warning: 'email_failed', error: String(e?.message || e) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return new Response(JSON.stringify({ ...(forwarded.json || {}), nextStatus: nextStatusEcho }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
