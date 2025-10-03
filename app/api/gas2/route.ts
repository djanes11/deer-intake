// app/api/gas2/route.ts (HTML attachment, initial email only + secure view link)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { sendEmail } from '@/lib/email';
import { renderFormHTML } from '@/lib/formAttachment';
import crypto from 'crypto';

const GAS_BASE = process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE;
const GAS_TOKEN = process.env.GAS_TOKEN || '';
const SITE = process.env.SITE_NAME || 'McAfee Custom Deer Processing';
const EMAIL_DEBUG = process.env.EMAIL_DEBUG === '1';
// strongly recommended for accurate public URLs
const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

type AnyRec = Record<string, any>;
const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '•') : '');

function log(...args: any[]) {
  console.log('[gas2]', ...args);
}
function logEnvOnce() {
  if ((globalThis as any).__envLogged) return;
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

function normProc(s: any): string {
  s = String(s || '').toLowerCase();
  if (s.includes('cape') && !s.includes('skull')) return 'Caped';
  if (s.includes('skull')) return 'Skull-Cap';
  if (s.includes('euro')) return 'European';
  if (s.includes('standard')) return 'Standard Processing';
  return '';
}
function processingPrice(proc: any, beef: boolean, webbs: boolean) {
  const p = normProc(proc);
  const base =
    p === 'Caped' ? 150 : ['Standard Processing', 'Skull-Cap', 'European'].includes(p) ? 130 : 0;
  return base ? base + (beef ? 5 : 0) + (webbs ? 20 : 0) : 0;
}
// kept for future
const isFinished = (s?: string) => {
  const v = String(s || '').toLowerCase();
  return v.includes('finish') || v.includes('ready') || v === 'finished';
};
// kept for future
const asBool = (v: any) => {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'on', 'paid', 'x', '✓', '✔'].includes(s);
};

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
    return { status: r.status, json: JSON.parse(text) as AnyRec };
  } catch {
    return { status: r.status, text };
  }
}

/** Prefer env; otherwise infer from request (best effort) */
function getSiteOrigin(req: Request) {
  if (SITE_URL) return SITE_URL;
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

/** 16-char HMAC tag token used in public view links */
function makeLinkToken(tag: string) {
  const key = GAS_TOKEN || (process.env.EMAIL_SIGNING_SECRET || '');
  if (!key) return ''; // if no secret, link will omit token
  return crypto.createHmac('sha256', key).update(tag).digest('hex').slice(0, 16);
}

export async function GET(req: NextRequest) {
  logEnvOnce();
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
  const body = (await req.json().catch(() => ({}))) as AnyRec;
  const action =
    String(body.action || body.endpoint || '').trim().toLowerCase() || (body.job ? 'save' : '');
  log('POST action=', action);

  if (action !== 'save') {
    const res = await gasPost(body);
    return new Response(res.text || JSON.stringify(res.json || {}), {
      status: res.status,
      headers: { 'Content-Type': res.text ? 'text/plain' : 'application/json' },
    });
  }

  const job = body.job || {};
  const tag = String(job.tag || '').trim();
  if (!tag) {
    log('skip: missing tag');
    return new Response(JSON.stringify({ ok: false, error: 'Missing job.tag' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // before
  const prevRes = await gasGet(tag).catch((e) => {
    log('gasGet prev error', e?.message || e);
    return null;
  });
  const prevExists = !!(prevRes && prevRes.exists && prevRes.job);
  const prev = prevExists ? (prevRes!.job as AnyRec) : null;
  log('prev exists=', prevExists, 'prevStatus=', prev?.status);

  // forward save
  const saved = await gasPost({ action: 'save', job });
  if (saved.status >= 400) {
    log('save upstream error:', saved.status, saved.text || saved.json);
    return new Response(
      saved.text || JSON.stringify(saved.json || { ok: false, error: 'Save failed' }),
      {
        status: saved.status,
        headers: { 'Content-Type': saved.text ? 'text/plain' : 'application/json' },
      }
    );
  }
  if (!saved.json || saved.json.ok === false) {
    log('save not ok:', saved.json);
    return new Response(JSON.stringify(saved.json || { ok: false, error: 'Save failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // after
  const latestRes = await gasGet(tag).catch((e) => {
    log('gasGet latest error', e?.message || e);
    return null;
  });
  const latest = latestRes && latestRes.job ? (latestRes.job as AnyRec) : job;
  log('latest status=', latest?.status, 'email=', latest?.email ? '[present]' : '[missing]');

  const customerEmail = String(latest.email || job.email || '').trim();
  const custName = String(latest.customer || latest['Customer Name'] || '').trim();

  // Triggers — only initial email now
  const shouldInitial = !prevExists;
  const shouldFinished = false;

  log('decisions -> shouldInitial=', shouldInitial);

  if (!customerEmail) {
    log('no customer email; skipping email');
  } else if (!shouldInitial && !shouldFinished) {
    log('conditions not met; skipping email');
  } else {
    // Build an HTML attachment of the form (no PDF, no headless Chrome)
    const htmlDoc = renderFormHTML(latest as AnyRec);
    const attachments = [
      {
        filename: `Deer-Intake-${tag}.html`,
        content: Buffer.from(htmlDoc, 'utf-8'),
        contentType: 'text/html; charset=utf-8',
      },
    ];

    // Public view link with short HMAC token (optional if no secret configured)
    const origin = getSiteOrigin(req as any);
    const token = makeLinkToken(tag);
    const viewUrl = origin
      ? `${origin}/intake/${encodeURIComponent(tag)}${token ? `?t=${token}` : ''}`
      : '';

    try {
      if (shouldInitial) {
        log('sending initial email ->', customerEmail, viewUrl ? '(with link)' : '(no link)');
        await sendEmail({
          to: customerEmail,
          subject: `${SITE} — Intake Confirmation (Tag ${tag})`,
          html: `<p>Hi ${custName || 'there'},</p>
                 <p>We received your deer (Tag <b>${tag}</b>).</p>
                 ${
                   viewUrl
                     ? `<p>View your intake form here: <a href="${viewUrl}">${viewUrl}</a></p>`
                     : ''
                 }
                 <p>Your intake form is attached for your records.</p>
                 <p>— ${SITE}</p>`,
        });
        log('initial email sent');
      }
      // no finished emails anymore
    } catch (e: any) {
      log('EMAIL_SEND_ERROR:', e?.message || e);
      if (EMAIL_DEBUG) {
        return new Response(
          JSON.stringify({
            ok: true,
            warning: 'email_failed',
            error: String(e?.message || e),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return new Response(JSON.stringify(saved.json), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

