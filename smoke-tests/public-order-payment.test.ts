import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { publicOrderPayment, savedMoney } from '../lib/publicOrderPayment.ts';

export async function run() {
  const reduced = { price_processing: 100, price_specialty: 25, price_total: 200, amount_paid_processing: 40 };
  let payment = publicOrderPayment(reduced);
  assert.equal(payment.priceTotal, 125);
  assert.equal(payment.owedTotal, 85);
  assert.equal(payment.paidOverall, false);
  payment = publicOrderPayment({ priceProcessing: 0, priceSpecialty: 0, processing_price_override: 145 }, { processing: 145, specialty: 50 });
  assert.equal(payment.priceTotal, 0);
  assert.equal(payment.owedTotal, 0);
  assert.equal(payment.paidOverall, true);
  payment = publicOrderPayment({ priceProcessing: 125, priceSpecialty: 20, paidProcessing: true }, { processing: 145, specialty: 60 });
  assert.equal(payment.priceTotal, 145);
  assert.equal(payment.owedProcessing, 0);
  assert.equal(payment.owedTotal, 20);
  assert.equal(payment.paidOverall, false);
  payment = publicOrderPayment({ priceProcessing: 125, priceSpecialty: 20, paidProcessing: false, amountPaidProcessing: 125, amountPaidSpecialty: 20 });
  assert.equal(payment.paidOverall, true);
  assert.equal(payment.owedTotal, 0);
  assert.equal(publicOrderPayment({ price_total: 145, paid: true }).owedTotal, 0);
  assert.equal(publicOrderPayment({ price_total: 145, amount_paid_processing: 40 }).owedTotal, 105);
  assert.equal(publicOrderPayment({ price_total: 145, price_specialty: 0 }).paidOverall, false);
  assert.equal(publicOrderPayment({ price_total: 145, price_specialty: 0 }).owedTotal, 145);
  assert.equal(publicOrderPayment({ price_specialty: 0 }).owedTotal, undefined);
  assert.equal(publicOrderPayment({}).paidOverall, false);
  assert.equal(publicOrderPayment({ paid: true, paid_processing: false, price_processing: 145, price_specialty: 0 }).owedTotal, 145);
  assert.equal(publicOrderPayment({ priceProcessing: 100.1, priceSpecialty: 5.2, amountPaidProcessing: 40.05 }).owedTotal, 65.25);
  assert.equal(savedMoney('$1,234.56'), 1234.56);
  assert.equal(savedMoney(''), undefined);

  // Exercise the API's actual public response, then the same interpretation used by the page.
  const source = ts.createSourceFile('route.ts', fs.readFileSync('app/api/public-status/route.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const shape = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'shapeJob')!;
  const code = ts.transpileModule(shape.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const shapeJob = new Function('publicOrderPayment', 'ensurePublicToken', code + '\nreturn shapeJob;')(publicOrderPayment, async () => 'sample-token');
  const result = await shapeJob(reduced, {});
  assert.equal(result.priceTotal, 125);
  assert.equal(publicOrderPayment(result).owedTotal, 85);
  const zero = await shapeJob({ price_processing: 0, price_specialty: 0, price_total: 145 }, {});
  assert.equal(zero.priceTotal, 0);
  assert.equal(publicOrderPayment(zero).owedTotal, 0);
}
