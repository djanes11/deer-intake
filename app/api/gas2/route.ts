// app/api/gas2/route.ts
// Initial email on first save (signed read-only link).
// Finished email once when status first becomes Finished/Ready (works for save OR progress).
// No attachments. No PDFs.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

type AnyRec = Record<string, any>;

const GAS_BASE = (process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE || '')
  .trim()
  .replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = process.env.GAS_TOKEN || ''; // used for GAS auth AND HMAC signing
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

/* ---------------- Pricing helpers (UPDATED) ---------------- */
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
  log('POST action=', action);

  // Tag-centric actions we enrich (save/progress); others pass through
  const tag = String((body.job && body.job.tag) || body.tag || '').trim();
  const isTagAction = ['save', 'progress'].includes(action);

  // ----- Overnight branch: save without tag when requiresTag === true -----
  const requiresTag =
    action === 'save' &&
    (body?.job?.requiresTag === true ||
      String(body?.job?.requiresTag || '').toLowerCase() === 'true');

  const isOvernight = action === 'save' && requiresTag && tag === '';

  if (isOvernight) {
    // Forward as an append-style save to GAS; skip tag-based GETs and email triggers.
    const payload = {
      action: 'save',
      job: { ...(body.job || {}), tag: '', requiresTag: true },
    };
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
    // Just return the upstream result; no emails, no follow-up GET since there's no tag yet.
    return new Response(
      forwarded.text || JSON.stringify(forwarded.json || { ok: true }),
      {
        status: 200,
        headers: { 'Content-Type': forwarded.text ? 'text/plain' : 'application/json' },
      }
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
  log('prev exists=', prevExists, 'prevStatus=', prev?.status);

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

    (body as any).nextStatus = nextStatus; // echo to client

    if (nextStatus) {
      // Force a SAVE-style payload for GAS: action=save and a merged job object
      body.status = nextStatus;
      body.tag = tag;
      body.action = 'save'; // <-- switch to save so GAS writes the sheet
      body.job = { ...(prev || {}), tag, status: nextStatus };
    }
  }

  // FORWARD to GAS (save or progress)
  const forwarded = await gasPost(body);
  if (forwarded.status >= 400) {
    log(`${action} upstream error:`, forwarded.status, forwarded.text || forwarded.json);
    return new Response(
      forwarded.text || JSON.stringify(forwarded.json || { ok: false, error: `${action} failed` }),
      {
        status: forwarded.status,
        headers: { 'Content-Type': forwarded.text ? 'text/plain' : 'application/json' },
      }
    );
  }
  if (!forwarded.json || forwarded.json.ok === false) {
    log(`${action} not ok:`, forwarded.json);
    return new Response(JSON.stringify(forwarded.json || { ok: false, error: `${action} failed` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // AFTER
  const latestRes = await gasGet(tag).catch((e) => {
    log('gasGet latest error', e?.message || e);
    return null;
  });
  const latest = latestRes && latestRes.job ? (latestRes.job as AnyRec) : (body.job || {});
  log('latest status=', latest?.status, 'email=', latest?.email ? '[present]' : '[missing]');

  // Determine authoritative nextStatus for the client (what we actually became)
  let nextStatusEcho: string | null =
    (body as any).nextStatus ?? (forwarded.json && forwarded.json.nextStatus) ?? null;
  const prevS = String(prev?.status || '').trim();
  const latestS = String(latest?.status || '').trim();
  if (latestS && latestS !== prevS) {
    nextStatusEcho = latestS;
  }

  // Triggers
  const shouldInitial = action === 'save' && !prevExists; // Initial only on first true save
  const finishedNow = isFinished(latest?.status);
  const finishedBefore = isFinished(prev?.status);
  const shouldFinished = finishedNow && !finishedBefore; // save OR progress

  const customerEmail = String(latest.email || (body.job && body.job.email) || '').trim();
  const custName = String(latest.customer || latest['Customer Name'] || '').trim();

  log(
    'decisions -> shouldInitial=',
    shouldInitial,
    'shouldFinished=',
    shouldFinished,
    'finishedNow=',
    finishedNow,
    'finishedBefore=',
    finishedBefore
  );

  if (!customerEmail) {
    log('no customer email; skipping email');
  } else {
    try {
      // Initial email (once, on first save)
      if (shouldInitial) {
        const viewUrl = formViewUrl(req, tag);
        log('sending initial email ->', customerEmail);
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
        log('initial email sent');
      }

      // Finished email (first transition to finished/ready)
      if (shouldFinished) {
        const procPrice = processingPrice(
          latest.processType,
          !!latest.beefFat,
          !!latest.webbsOrder
        );
        const paidProcessing = !!(latest.paidProcessing || latest['Paid Processing']);
        const stillOwe = paidProcessing ? 0 : Math.max(0, procPrice);

        log('sending finished email -> stillOwe=', stillOwe);
        const owedBlock =
          stillOwe > 0
            ? `<p><b>Amount still owed (regular processing): $${stillOwe.toFixed(2)}</b></p>`
            : '';

        await sendEmail({
          to: customerEmail,
          subject: `${SITE} — Finished & Ready (Tag ${tag})`,
          html: [
            `<p>Hi ${custName || 'there'},</p>`,
            `<p>Your regular processing is finished and ready for pickup.</p>`,
            owedBlock,
            `<p><b>Pickup hours</b>: 6:00 pm–8:00 pm Monday–Friday, 9:00 am–5:00 pm Saturday & Sunday.</p>`,
            `<p>Please contact Travis at <a href="tel:15026433916">(502) 643-3916</a> to confirm your pickup time or ask any questions.</p>`,
            `<p>Please bring a cooler or box to transport your meat.</p>`,
            `<p><em>Reminder:</em> This update is for your regular processing only. We’ll reach out separately about any Webbs orders or McAfee Specialty Products.</p>`,
            `<p>— ${SITE}</p>`,
          ].join(''),
        });
        log('finished email sent');
      }
    } catch (e: any) {
      log('EMAIL_SEND_ERROR:', e?.message || e);
      if (EMAIL_DEBUG) {
        return new Response(
          JSON.stringify({ ok: true, warning: 'email_failed', error: String(e?.message || e) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Return GAS upstream payload (with nextStatus echoed authoritatively)
  const merged = {
    ...(forwarded.json || {}),
    nextStatus: nextStatusEcho,
  };

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

