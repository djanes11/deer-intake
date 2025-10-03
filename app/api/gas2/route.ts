// app/api/gas2/route.ts (HTML link to read-only view; initial email only)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { sendEmail } from '@/lib/email';
import { renderFormHTML } from '@/lib/formAttachment'; // kept if you later want to attach HTML again

type AnyRec = Record<string, any>;

const GAS_BASE = (process.env.NEXT_PUBLIC_GAS_BASE || process.env.GAS_BASE || '').trim().replace(/^['"]|['"]$/g, '');
const GAS_TOKEN = process.env.GAS_TOKEN || ''; // also used as HMAC secret for the public view link
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

// ---------- Pricing helpers (kept for future use) ----------
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
  const base = p === 'Caped' ? 150 : (['Standard Processing','Skull-Cap','European'].includes(p) ? 130 : 0);
  return base ? base + (beef ? 5 : 0) + (webbs ? 20 : 0) : 0;
}

// ---------- GAS helpers ----------
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
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) as AnyRec }; }
  catch { return { status: r.status, text }; }
}

// ---------- Site origin + signed link helpers ----------
function getSiteOrigin(req: Request) {
  const env = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch { return ''; }
}
import crypto from 'crypto';
function hmac16(tag: string) {
  if (!GAS_TOKEN) return '';
  return crypto.createHmac('sha256', GAS_TOKEN).update(tag).digest('hex').slice(0,16);
}
function formViewUrl(req: Request, tag: string) {
  const origin = getSiteOrigin(req);
  const t = hmac16(tag);
  const url = new URL(`${origin}/intake/${encodeURIComponent(tag)}`);
  if (t) url.searchParams.set('t', t);
  return url.toString();
}

export async function GET(req: NextRequest) {
  logEnvOnce();
  if (!GAS_BASE) {
    return new Response(JSON.stringify({ ok:false, error:'GAS_BASE missing' }), { status: 500 });
  }
  const url = new URL(GAS_BASE!);
  req.nextUrl.searchParams.forEach((v,k)=>url.searchParams.set(k,v));
  if (!url.searchParams.get('action') && !url.searchParams.get('endpoint')) url.searchParams.set('action','ping');
  if (GAS_TOKEN) url.searchParams.set('token', GAS_TOKEN);
  const upstream = await fetch(url.toString(), { cache: 'no-store' });
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' } });
}

export async function POST(req: NextRequest) {
  logEnvOnce();
  if (!GAS_BASE) {
    log('fatal: GAS_BASE missing');
    return new Response(JSON.stringify({ ok:false, error:'Server misconfigured: GAS_BASE missing' }), { status: 500 });
  }

  const body = await req.json().catch(()=>({} as AnyRec));
  const action = String(body.action || body.endpoint || '').trim().toLowerCase() || (body.job ? 'save' : '');
  log('POST action=', action);

  if (action !== 'save') {
    const res = await gasPost(body);
    return new Response(res.text || JSON.stringify(res.json || {}), { status: res.status, headers: { 'Content-Type': res.text ? 'text/plain' : 'application/json' } });
  }

  const job = body.job || {};
  const tag = String(job.tag || '').trim();
  if (!tag) {
    log('skip: missing tag');
    return new Response(JSON.stringify({ ok:false, error:'Missing job.tag' }), { status: 400 });
  }

  // before
  const prevRes = await gasGet(tag).catch(e => { log('gasGet prev error', e?.message || e); return null; });
  const prevExists = !!(prevRes && prevRes.exists && prevRes.job);
  const prev = prevExists ? prevRes!.job as AnyRec : null;
  log('prev exists=', prevExists, 'prevStatus=', prev?.status);

  // save forward
  const saved = await gasPost({ action:'save', job });
  if (saved.status >= 400) {
    log('save upstream error:', saved.status, saved.text || saved.json);
    return new Response(saved.text || JSON.stringify(saved.json || { ok:false, error:'Save failed' }), { status: saved.status, headers: { 'Content-Type': saved.text ? 'text/plain' : 'application/json' } });
  }
  if (!saved.json || saved.json.ok === false) {
    log('save not ok:', saved.json);
    return new Response(JSON.stringify(saved.json || { ok:false, error:'Save failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  // after
  const latestRes = await gasGet(tag).catch(e => { log('gasGet latest error', e?.message || e); return null; });
  const latest = latestRes && latestRes.job ? latestRes.job as AnyRec : job;
  log('latest status=', latest?.status, 'email=', latest?.email ? '[present]' : '[missing]');

  // Triggers — initial only
  const shouldInitial = !prevExists;

  const customerEmail = String(latest.email || job.email || '').trim();
  const custName = String(latest.customer || latest['Customer Name'] || '').trim();

  if (!customerEmail) {
    log('no customer email; skipping email');
  } else if (!shouldInitial) {
    log('conditions not met; skipping email');
  } else {
    const viewUrl = formViewUrl(req, tag);
    try {
      log('sending initial email ->', customerEmail);
      await sendEmail({
        to: customerEmail,
        subject: `${SITE} — Intake Confirmation (Tag ${tag})`,
        html: [
          `<p>Hi ${custName || 'there'},</p>`,
          `<p>We received your deer (Tag <b>${tag}</b>).</p>`,
          `<p><a href="${viewUrl}" target="_blank" rel="noopener">Click here to view your intake form</a> (read‑only).</p>`,
          `<p>— ${SITE}</p>`
        ].join('')
      });
      log('initial email sent');
    } catch (e: any) {
      log('EMAIL_SEND_ERROR:', e?.message || e);
      if (EMAIL_DEBUG) {
        return new Response(JSON.stringify({ ok:true, warning:'email_failed', error:String(e?.message || e) }), { status: 200, headers: { 'Content-Type':'application/json' } });
      }
    }
  }

  return new Response(JSON.stringify(saved.json), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

