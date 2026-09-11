import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { persistJobRecord } from '../lib/jobWriteSafety.ts';

const processor = '00000000-0000-4000-8000-000000000001';
const otherProcessor = '00000000-0000-4000-8000-000000000002';

export async function run() {
  // Isolated, in-memory PostgreSQL. No .env, customer data, or network access.
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table processors(id uuid primary key);
      insert into processors values ('${processor}'), ('${otherProcessor}');
      create table jobs (
        id uuid primary key default gen_random_uuid(), processor_id uuid references processors,
        tag text not null, confirmation text unique, customer_name text, notes text,
        status text, requires_tag boolean default false, pending_deleted_at timestamptz,
        price_processing numeric default 0, price_specialty numeric default 0,
        amount_paid_processing numeric default 0, amount_paid_specialty numeric default 0,
        paid_processing boolean default false, paid_specialty boolean default false, paid boolean default false,
        payment_method_processing text, paid_processing_at timestamptz,
        updated_at timestamptz not null default clock_timestamp(), created_at timestamptz default now(),
        unique(processor_id,tag)
      );
      create table job_specialty_items (
        id uuid primary key default gen_random_uuid(), job_id uuid references jobs, processor_id uuid,
        processor_specialty_item_id uuid, item_slug text, item_name text, short_name text,
        unit text, price_type text, quantity numeric check(quantity >= 0), unit_price numeric,
        total_price numeric, sort_order integer, unique(job_id,item_slug)
      );
    `);
    await db.exec(fs.readFileSync('sql/2026-08-24-square-payment-links.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    const migration = fs.readFileSync('sql/2026-09-11-opening-weekend-safety.sql', 'utf8');
    await db.exec(migration);

    const rpc = { async rpc(name: string, args: any) {
      try {
        const result = await db.query<{ value: any }>(`select public.${name}($1,$2,$3,$4,$5) as value`, [
          args.p_job_id, args.p_processor_id, args.p_expected_updated_at, args.p_payload, args.p_specialty_items,
        ]);
        return { data: result.rows[0].value, error: null };
      } catch (error) { return { data: null, error }; }
    } };
    const save = (payload: any, existing?: any, specialtyItems: any[] | null = null, scope = processor) => persistJobRecord(rpc, {
      jobId: existing?.id || null, expectedUpdatedAt: existing?.updated_at || null,
      processorId: scope, payload, specialtyItems,
    });
    const read = async (id: string) => (await db.query<{ value: any }>('select to_jsonb(jobs) as value from jobs where id=$1', [id])).rows[0].value;
    const payload = { tag: '10001', confirmation: '1234567890123', customer_name: 'Hunter A', status: 'Dropped Off',
      price_processing: 150, amount_paid_processing: 50, price_specialty: 0, amount_paid_specialty: 0 };
    let job = await save(payload);

    await assert.rejects(save({ ...payload, confirmation: '2234567890123', customer_name: 'Hunter B' }), /already in use/);
    assert.equal((await read(job.id)).customer_name, 'Hunter A');
    await assert.rejects(save({ ...payload, notes: 'Wrong shop' }, job, null, otherProcessor), /another station/);
    await assert.rejects(save({ ...payload, tag: 'renamed' }, job), /another station/);
    const writes = await Promise.allSettled([
      save({ ...payload, notes: 'Station A' }, job),
      save({ ...payload, notes: 'Station B' }, job),
    ]);
    assert.equal(writes.filter((result) => result.status === 'fulfilled').length, 1);
    job = await read(job.id);

    // A failure saving child items rolls back the entire customer/order edit.
    await assert.rejects(save({ ...payload, customer_name: 'Must roll back' }, job, [{
      slug: 'sausage', name: 'Sausage', shortName: 'SS', unit: 'lb', priceType: 'per_lb',
      quantity: -1, pricePerUnit: 5, total: -5, sortOrder: 1,
    }]));
    assert.equal((await read(job.id)).customer_name, 'Hunter A');

    // A stale queue can assign a pending deer only once, regardless of proposed tag.
    const pending = await save({ tag: 'PENDING-X', confirmation: 'short-freeform', requires_tag: true });
    const assign = (tag: string) => db.query(`update jobs set tag=$1, requires_tag=false where id=$2
      and requires_tag=true and tag='PENDING-X' and pending_deleted_at is null returning id`, [tag, pending.id]);
    const assignments = await Promise.all([assign('10002'), assign('10003')]);
    assert.equal(assignments.reduce((sum, result) => sum + result.rows.length, 0), 1);

    const addLink = async (order: string, target = job, status = 'pending') => {
      await db.query(`insert into square_payment_links(job_id,processor_id,amount_cents,processing_amount_cents,
        online_fee_cents,square_order_id,idempotency_key,status) values($1,$2,10300,10000,300,$3,$3,$4)`,
        [target.id, target.processor_id, order, status]);
    };
    const pay = async (order: string, payment = order + '-payment', amount = 10300, currency = 'USD', status = 'COMPLETED') => {
      const result = await db.query<{ value: any }>('select apply_square_processing_payment($1,$2,$3,$4,$5,$6,$7) as value',
        [order, payment, status, amount, currency, 'payment.updated', { id: 'test-event' }]);
      return result.rows[0].value;
    };
    await addLink('deposit-balance');
    const oldScreen = job;
    const results = await Promise.all([pay('deposit-balance'), pay('deposit-balance')]);
    assert.equal(results.filter((result) => result.alreadyApplied).length, 1);
    job = await read(job.id);
    assert.equal(Number(job.amount_paid_processing), 150, '$50 deposit + $100 online must equal $150');
    assert.equal(job.paid_processing, true);
    assert.equal(job.paid, true);
    await assert.rejects(save({ ...payload, notes: 'Stale screen' }, oldScreen), /another station/);
    assert.equal(Number((await read(job.id)).amount_paid_processing), 150);
    await pay('deposit-balance', 'deposit-balance-payment', 10300, 'USD', 'APPROVED');
    assert.equal((await db.query<any>("select status from square_payment_links where square_order_id='deposit-balance'")).rows[0].status, 'completed');

    // Retired links never apply, even on repeated or out-of-order delivery.
    await addLink('retired', job, 'superseded');
    assert.equal((await pay('retired')).needsReview, true);
    await pay('retired', 'retired-payment', 10300, 'USD', 'APPROVED');
    await pay('retired');
    assert.equal(Number((await read(job.id)).amount_paid_processing), 150);

    const mismatchJob = await save({ ...payload, tag: '10004', confirmation: '3234567890123', amount_paid_processing: 0 });
    await addLink('wrong-amount', mismatchJob);
    assert.equal((await pay('wrong-amount', 'wrong', 100)).status, 'completed_amount_mismatch');
    assert.equal(Number((await read(mismatchJob.id)).amount_paid_processing), 0);
    await addLink('wrong-currency', mismatchJob);
    assert.equal((await pay('wrong-currency', 'wrong-currency', 10300, 'CAD')).needsReview, true);
    assert.equal(Number((await read(mismatchJob.id)).amount_paid_processing), 0);

    // Retire active links in the same transaction as in-person payment.
    await addLink('cash-paid', mismatchJob);
    await save({ ...payload, tag: mismatchJob.tag, confirmation: mismatchJob.confirmation, amount_paid_processing: 150 }, mismatchJob);
    assert.equal((await pay('cash-paid')).status, 'completed_after_superseded');
    assert.equal(Number((await read(mismatchJob.id)).amount_paid_processing), 150);

    // A failure at the final credit marker must also roll back the job payment.
    const rollbackJob = await save({ ...payload, tag: '10005', confirmation: '4234567890123' });
    await addLink('rollback-payment', rollbackJob);
    await assert.rejects(pay('rollback-payment', 'deposit-balance-payment'), /duplicate key/);
    assert.equal(Number((await read(rollbackJob.id)).amount_paid_processing), 50);
    assert.equal((await db.query<any>("select status from square_payment_links where square_order_id='rollback-payment'")).rows[0].status, 'pending');
    await pay('rollback-payment', 'new-valid-payment');
    assert.equal(Number((await read(rollbackJob.id)).amount_paid_processing), 150);

    const legacyJob = await save({ ...payload, tag: '10006', confirmation: '5234567890123', amount_paid_processing: 150 });
    await addLink('legacy-completed', legacyJob, 'completed');

    // Migration is repeatable, and replaying a completed pre-migration payment cannot add money again.
    await db.exec(migration);
    assert.equal((await pay('legacy-completed')).alreadyApplied, true);
    assert.equal(Number((await read(legacyJob.id)).amount_paid_processing), 150);
    await pay('deposit-balance');
    assert.equal(Number((await read(job.id)).amount_paid_processing), 150);
    const privileges = await db.query<{ allowed: boolean }>(`select has_function_privilege('anon',
      'public.save_job_guarded(uuid,uuid,timestamptz,jsonb,jsonb)', 'execute') as allowed`);
    assert.equal(privileges.rows[0].allowed, false);
  } finally { await db.close(); }
}
