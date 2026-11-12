import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { sendCheckinEmailOnce } from '../lib/checkinEmailDelivery.ts';

export async function run() {
  const attempts = new Map<string, any>();
  let sends = 0, stamps = 0, failReservation = false, failSend = false;
  const job = { id: 'deer-1', processor_id: 'shop-1', tag: '494001', email: 'test@example.com', public_token: 'stable-token' };
  const db: any = { from(table: string) {
    if (table === 'jobs') {
      const query: any = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => ({ data: job }) };
      return query;
    }
    assert.equal(table, 'job_checkin_email_delivery');
    return {
      async insert(row: any) {
        if (failReservation) return { error: { code: '42P01' } };
        if (attempts.has(row.job_id)) return { error: { code: '23505' } };
        attempts.set(row.job_id, { ...row }); return { error: null };
      },
      update(patch: any) { return { async eq(_key: string, id: string) { Object.assign(attempts.get(id), patch); return { error: null }; } }; },
    };
  } };
  const send = async () => { sends++; if (failSend) throw new Error('SMTP timeout after possible acceptance'); };
  await Promise.all(Array.from({ length: 75 }, () => sendCheckinEmailOnce(db, job, send)));
  assert.equal(sends, 1, 'Concurrent requests get only one SMTP attempt');
  assert.equal(attempts.get(job.id).state, 'sent');
  await sendCheckinEmailOnce(db, { ...job, tag: '494002' } as any, send);
  assert.equal(sends, 1, 'Correcting the tag does not resend the same permanent link');
  await sendCheckinEmailOnce(db, { ...job, id: 'deer-2' }, send);
  assert.equal(sends, 2, 'A different deer may receive its own email');
  attempts.clear(); failSend = true;
  await assert.rejects(() => sendCheckinEmailOnce(db, job, send), /SMTP timeout/);
  assert.equal(attempts.get(job.id).state, 'uncertain');
  const beforeRetry = sends;
  failSend = false; await sendCheckinEmailOnce(db, job, send);
  assert.equal(sends, beforeRetry, 'Ambiguous delivery must not cause automatic duplicates');
  attempts.clear(); failReservation = true;
  await assert.rejects(() => sendCheckinEmailOnce(db, job, send), /Verify sql/);
  assert.equal(sends, beforeRetry, 'Missing migration fails closed before SMTP');
  failReservation = false;

  // Exercise the actual automatic notification flow, including its sent stamp.
  const source = ts.createSourceFile('jobsSupabase.ts', fs.readFileSync('lib/jobsSupabase.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['trySendDropoffEmail', 'intakeFormLink'];
  const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text || ''));
  assert.equal(functions.length, names.length);
  const code = ts.transpileModule(functions.map(n => n.getText(source)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const deps: Record<string, any> = {
    SITE_URL: 'https://example.com', normalizeBaseUrl: (url: string) => url,
    hasRealTag: (row: any) => !!row.tag && !row.tag.startsWith('PENDING-'),
    shouldSendEmailNotification: (row: any) => row.pref_email !== false,
    ensurePublicToken: async () => job.public_token,
    withProcessorFilter: (query: any) => query,
    publicBaseUrlForRow: async () => 'https://example.com', getNotificationBranding: async () => ({}),
    buildIntakeEmail: (args: any) => { assert.equal(args.link, 'https://example.com/i/stable-token'); return { subject: 'Checked in', html: '', text: '' }; },
    statusPageLink: () => 'https://example.com/status', sendEmail: send,
    sendCheckinEmailOnce, stampNotificationField: async () => { stamps++; },
  };
  const actual = new Function(...Object.keys(deps), code + '\nreturn { trySendDropoffEmail, intakeFormLink };')(...Object.values(deps));
  attempts.clear(); sends = 0;
  await Promise.all(Array.from({ length: 75 }, () => actual.trySendDropoffEmail(db, { ...job })));
  assert.equal(sends, 1); assert.equal(stamps, 1);
  attempts.clear();
  for (const row of [{ ...job, dropoff_email_sent_at: 'sent' }, { ...job, requires_tag: true }, { ...job, pref_email: false }, { ...job, tag: 'PENDING-ABC' }]) await actual.trySendDropoffEmail(db, row);
  assert.equal(attempts.size, 0);
  assert.equal(actual.intakeFormLink('494001', 'stable-token'), actual.intakeFormLink('494002', 'stable-token'));

  // The public token route resolves the current tag instead of storing the old one.
  const pageCode = ts.transpileModule(fs.readFileSync('app/intake/view/[token]/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as any };
  const modules: Record<string, any> = {
    'server-only': {}, 'react/jsx-runtime': {}, '@/app/intake/ReadOnlyAccessHelp': {},
    'next/navigation': { redirect: (url: string) => { throw Object.assign(new Error(url), { digest: 'NEXT_REDIRECT' }); } },
    '@/lib/jobsSupabase': { getJobByPublicToken: async (token: string) => { assert.equal(token, 'stable-token'); return { exists: true, job: { tag: '494002' } }; } },
  };
  new Function('require', 'module', 'exports', pageCode)((name: string) => modules[name], module, module.exports);
  await assert.rejects(() => module.exports.default({ params: Promise.resolve({ token: 'stable-token' }) }), /\/intake\/494002\?t=stable-token/);
}
