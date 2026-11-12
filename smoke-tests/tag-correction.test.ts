import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { correctJobTag } from '../lib/jobTagCorrection.ts';
import { identifierSettingsFromPublicCopy } from '../lib/identifiers.ts';

export async function run() {
  const identifiers = identifierSettingsFromPublicCopy(null);
  const input = { processorId: 'shop-a', role: 'admin', jobId: 'deer-a', oldTag: '494001', newTag: '494002', updatedAt: 'v1', identifiers };
  const original = { id: 'deer-a', processor_id: 'shop-a', tag: '494001', updated_at: 'v1', requires_tag: false, pending_deleted_at: null, price_total: 170, amount_paid_processing: 170, public_token: 'unchanged', intake_sheet_printed_at: 'printed' };
  let rows: any[] = [], writes = 0, payload: any;
  function reset() { rows = [{ ...original }]; writes = 0; }
  const db = { from(table: string) {
    assert.equal(table, 'jobs');
    let filters: Array<[string, any]> = [];
    const query: any = {
      update(value: any) { writes++; payload = value; return query; },
      eq(k: string, v: any) { filters.push([k, v]); return query; },
      is(k: string, v: any) { filters.push([k, v]); return query; },
      or(value: string) { assert.equal(value, 'requires_tag.is.null,requires_tag.eq.false'); return query; },
      select(value: string) { assert.equal(value, 'id,tag,updated_at'); return query; },
      async maybeSingle() {
        const row = rows.find(r => filters.every(([k, v]) => r[k] === v) && !r.requires_tag);
        if (!row) return { data: null, error: null };
        if (rows.some(r => r.id !== row.id && r.processor_id === row.processor_id && r.tag === payload.tag)) return { data: null, error: { code: '23505' } };
        Object.assign(row, payload);
        return { data: { ...row }, error: null };
      },
    };
    return query;
  } };
  reset();
  const corrected = await correctJobTag(db, input);
  assert.equal(corrected.tag, '494002');
  assert.deepEqual(Object.keys(payload).sort(), ['intake_sheet_printed_at', 'tag', 'updated_at']);
  assert.equal(rows[0].price_total, 170);
  assert.equal(rows[0].amount_paid_processing, 170);
  assert.equal(rows[0].public_token, 'unchanged');
  assert.equal(rows[0].intake_sheet_printed_at, null);
  assert.equal(rows[0].id, original.id);
  // Replay and a second station holding the old snapshot cannot change it again.
  await assert.rejects(() => correctJobTag(db, { ...input, newTag: '494003' }), /another station/);
  for (const role of ['staff', 'readonly', null]) {
    reset(); await assert.rejects(() => correctJobTag(db, { ...input, role }), /Only admins/); assert.equal(writes, 0);
  }
  for (const newTag of ['', '494001', 'invalid!', 'PENDING-123']) {
    reset(); await assert.rejects(() => correctJobTag(db, { ...input, newTag })); assert.equal(writes, 0);
  }
  for (const change of [{ processorId: 'other-shop' }, { jobId: 'other-deer' }, { updatedAt: 'stale' }, { oldTag: '494009' }]) {
    reset(); await assert.rejects(() => correctJobTag(db, { ...input, ...change }), /another station/); assert.equal(rows[0].tag, original.tag);
  }
  for (const change of [{ requires_tag: true }, { pending_deleted_at: 'deleted' }]) {
    reset(); Object.assign(rows[0], change); await assert.rejects(() => correctJobTag(db, input));
  }
  reset(); rows.push({ ...original, id: 'deer-b', tag: input.newTag });
  await assert.rejects(() => correctJobTag(db, input), /already in use/);
  assert.equal(rows[0].tag, original.tag);
  reset(); rows.push({ ...original, id: 'deer-b', processor_id: 'shop-b', tag: input.newTag });
  assert.equal((await correctJobTag(db, input)).tag, input.newTag);

  // Exercise the actual HTTP route: roles, failed correction, and audit failure.
  const code = ts.transpileModule(fs.readFileSync('app/api/v2/jobs/correct-tag/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  let role = 'staff', called = 0, auditFails = false;
  const deps: Record<string, any> = {
    'next/server': { NextResponse: { json: (body: any, init?: any) => Response.json(body, init) } },
    '@/lib/staffPermissions': { requireProcessorPermission: async () => ({ denied: null, context: { id: 'shop-a', role } }) },
    '@/lib/supabaseClient': { getSupabaseServer: () => db },
    '@/lib/siteSettings': { getPublicSiteSettings: async () => ({ publicCopy: null }) },
    '@/lib/identifiers': { identifierSettingsFromPublicCopy },
    '@/lib/jobTagCorrection': { correctJobTag: async (...args: Parameters<typeof correctJobTag>) => { called++; return correctJobTag(...args); } },
    '@/lib/jobWriteSafety': await import('../lib/jobWriteSafety.ts'),
    '@/lib/auditLog': { writeAuditEntry: async () => { if (auditFails) throw new Error('audit unavailable'); } },
  };
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', 'console', code)((name: string) => deps[name], module, module.exports, { error() {} });
  const request = (body: any = input) => new Request('https://example/api/v2/jobs/correct-tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await module.exports.POST(request())).status, 403); assert.equal(called, 0);
  role = 'admin'; reset();
  assert.equal((await module.exports.POST(request({}))).status, 400);
  auditFails = true;
  const result = await module.exports.POST(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ok, true, 'An audit failure must not report that a committed correction failed');
  assert.equal((await module.exports.POST(request())).status, 409);

  // Exercise the actual correction component's cancel, success, and conflict paths.
  const uiCode = ts.transpileModule(fs.readFileSync('app/components/TagCorrection.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let state: any[] = [], cursor = 0, busy = false, confirmed = true, navigated = '', sent: any = null, conflict = false;
  const jsx = (type: any, props: any) => ({ type, props });
  const uiDeps: Record<string, any> = {
    react: { useState(initial: any) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (v: any) => { state[i] = v; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lib/identifiers': await import('../lib/identifiers.ts'),
  };
  const ui = { exports: {} as any };
  new Function('require', 'module', 'exports', 'window', 'fetch', uiCode)(
    (name: string) => uiDeps[name], ui, ui.exports,
    { confirm: () => confirmed, alert() {}, location: { replace: (url: string) => { navigated = url; } } },
    async (_url: string, init: any) => { sent = JSON.parse(init.body); return { ok: !conflict, json: async () => conflict ? { ok: false, error: 'Another station changed this deer.' } : { ok: true, job: { tag: input.newTag } } }; },
  );
  const props = { job: { id: input.jobId, tag: input.oldTag, updatedAt: input.updatedAt }, identifiers, disabled: false, onBusyChange: (v: boolean) => { busy = v; } };
  const render = () => { cursor = 0; return ui.exports.default(props); };
  function nodes(root: any): any[] { if (!root || typeof root !== 'object') return []; if (Array.isArray(root)) return root.flatMap(nodes); return [root, ...nodes(root.props?.children)]; }
  const button = (label: string) => nodes(render()).find(n => n.type === 'button' && n.props.children === label);
  props.disabled = true; assert.equal(button('Correct tag').props.disabled, true); props.disabled = false;
  button('Correct tag').props.onClick();
  nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value: input.newTag } });
  confirmed = false; await button('Save corrected tag').props.onClick(); assert.equal(sent, null); assert.equal(busy, false);
  confirmed = true; await button('Save corrected tag').props.onClick();
  assert.deepEqual(sent, { jobId: input.jobId, oldTag: input.oldTag, newTag: input.newTag, updatedAt: input.updatedAt });
  assert.equal(navigated, '/intake?tag=494002&tagCorrected=1'); assert.equal(busy, true);
  state = []; navigated = ''; busy = false; conflict = true;
  button('Correct tag').props.onClick();
  nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value: input.newTag } });
  await button('Save corrected tag').props.onClick();
  assert.equal(busy, false); assert.equal(navigated, '');
  assert.equal(nodes(render()).find(n => n.props?.role === 'alert').props.children, 'Another station changed this deer.');
}
