import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { defaultPublicSiteSettings } from '../lib/siteSettings.ts';
import { publicIntakeInput } from '../lib/publicIntakeInput.ts';
import { specialtyBreakdown } from '../lib/specialty.ts';
import { identifierSettingsFromPublicCopy, validateTag } from '../lib/identifiers.ts';
import { normalizeJobAddOnItems } from '../lib/processorCatalog.ts';
import { normalizeWebbsAllocations, normalizeWebbsOrderItems, normalizeWebbsOrderStyle } from '../lib/webbs.ts';

export async function run() {
  // Execute the actual assignment, database mapping, and specialty loader with
  // fake I/O, so omitting the line items from the returned job fails this test.
  const source = ts.createSourceFile('jobsSupabase.ts', fs.readFileSync('lib/jobsSupabase.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['setJobTag', 'loadJobSpecialtyItemsMap', 'mapDbRowToJob', 'paymentMethodOrNull', 'withProcessorFilter'];
  const functions = source.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''));
  assert.equal(functions.length, names.length);
  const code = ts.transpileModule(functions.map((node) => node.getText(source).replace(/^export /, '')).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const settings = defaultPublicSiteSettings();
  settings.features.specialtyEnabled = true;
  const products = settings.specialtyCatalog.filter((item) => item.active).slice(0, 2);
  assert.equal(products.length, 2);
  const clean = publicIntakeInput({
    sex: 'Buck', processType: settings.processCatalog.find((item) => item.active && !item.donationOnly)!.name,
    specialtyProducts: true, specialtyItems: products.map((item, i) => ({ slug: item.slug, quantity: (i + 1) * 5 })),
  }, settings);
  const savedRows = clean.specialtyItems.map((item: any) => ({
    job_id: 'public-job', item_slug: item.slug, item_name: item.name, short_name: item.shortName,
    quantity: item.quantity, unit_price: item.pricePerUnit, total_price: item.total,
    unit: item.unit, price_type: item.priceType, sort_order: item.sortOrder,
  }));
  const pending = { id: 'public-job', tag: 'PENDING-TEST', requires_tag: true, specialty_products: true, specialty_pounds: 15 };
  let reads = 0;
  let updates = 0;
  let failItems = false;
  const supabase = { from(table: string) {
    const query: any = {
      select() { return query; }, eq() { return query; }, neq() { return query; }, is() { return query; },
      in(_key: string, ids: string[]) { assert.deepEqual(ids, ['public-job']); return query; },
      order() { if (failItems) throw new Error('Specialty read unavailable'); return Promise.resolve({ data: savedRows }); },
      update() { updates++; return query; },
      maybeSingle() { reads++; return Promise.resolve({ data: reads === 1 ? null : reads === 2 ? pending : { ...pending, tag: '10001', requires_tag: false } }); },
    };
    assert.ok(['jobs', 'job_specialty_items'].includes(table));
    return query;
  } };
  const deps = {
    getSupabaseServer: () => supabase, getPublicSiteSettings: async () => settings,
    identifierSettingsFromPublicCopy, validateTag, normalizeJobAddOnItems,
    normalizeWebbsAllocations, normalizeWebbsOrderItems, normalizeWebbsOrderStyle,
    JOB_DETAIL_SELECT: '*', nowIso: () => '2026-09-29T12:00:00Z',
    trySendNotificationEmails: async () => {}, trySendNotificationSms: async () => {},
  };
  const assign = new Function(...Object.keys(deps), code + '\nreturn setJobTag;')(...Object.values(deps));
  const result = await assign({ jobId: pending.id, newTag: '10001', returnRow: true, processorContext: { id: 'shop' } });
  assert.equal(result.ok, true);
  assert.equal(updates, 1);
  const printed = specialtyBreakdown(result.job).filter((item) => item.pounds > 0);
  assert.deepEqual(printed.map((item) => [item.label, item.pounds]), products.map((item, i) => [item.name, (i + 1) * 5]));
  assert.equal(result.job.specialtyPounds, 15);
  reads = 0; updates = 0; failItems = true;
  await assert.rejects(assign({ jobId: pending.id, newTag: '10001', returnRow: true, processorContext: { id: 'shop' } }), /Specialty read unavailable/);
  assert.equal(updates, 0, 'A failed detail load must leave the public intake available for retry');
}
