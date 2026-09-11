import assert from 'node:assert/strict';
import { saveJob, patchJob } from '../lib/api.ts';

export async function run() {
  const originalFetch = globalThis.fetch;
  const requests: any[] = [];
  try {
    globalThis.fetch = (async (_url: any, options: any) => {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true, job: { id: 'created-id', tag: '10001', updatedAt: 'v1' } }));
    }) as typeof fetch;
    const result = await saveJob({ tag: '10001', customer: 'Test Hunter' });
    await saveJob({ ...result.job, notes: 'Edited' });
    await patchJob({ tag: '10001', specialtyStatus: 'Picked Up' });
    assert.equal(requests[0].action, 'save');
    assert.equal(requests[0].job.id, undefined);
    assert.equal(requests[1].job.id, 'created-id');
    assert.equal(requests[1].job.updatedAt, 'v1');
    assert.equal(requests[2].action, 'patch');
    assert.equal(requests[2].job.customer, undefined);
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Reload this deer before saving again.' }), { status: 409 })) as typeof fetch;
    await assert.rejects(saveJob({ tag: '10001' }), { message: 'Reload this deer before saving again.' });
  } finally { globalThis.fetch = originalFetch; }
}
