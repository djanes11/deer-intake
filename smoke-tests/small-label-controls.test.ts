import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as printing from '../lib/smallLabelPrinting.ts';

export async function run() {
  const code = ts.transpileModule(fs.readFileSync('app/components/SmallLabelControls.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const oldFetch = globalThis.fetch;
  try {
    for (const scenario of ['success', 'double-click', 'changed', 'reassigned', 'missing', 'unsaved', 'disabled', 'pending', 'no-printer', 'session-failure', 'uncertain']) {
      let sent = 0, loaded = 0;
      const states: any[] = []; let cursor = 0;
      const job = { id: 'job-a', customer: 'Sample Customer', tag: scenario === 'pending' ? 'PENDING-1' : '10001', phone: '5555550100' };
      globalThis.fetch = (async () => ({ status: scenario === 'session-failure' ? 503 : 200, ok: scenario !== 'session-failure' })) as any;
      const deps: Record<string, any> = {
        'react': {
          useState: (initial: any) => { const index = cursor++; states[index] = initial; return [initial, (value: any) => { states[index] = value; }]; },
          useRef: (value: any) => ({ current: value }), useEffect: () => {},
        },
        'react/jsx-runtime': { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) },
        '@/lib/api': { getJob: async () => {
          loaded++;
          return { job: scenario === 'missing' ? null : { ...job, ...(scenario === 'changed' ? { phone: '5555550199' } : {}), ...(scenario === 'reassigned' ? { id: 'job-b' } : {}) } };
        } },
        '@/lib/smallLabelPrinting': {
          ...printing,
          readSmallLabelSettings: () => ({ printer: scenario === 'no-printer' ? '' : 'Twin', roll: 'Right', packages: 2 }),
          connectSmallLabelPrinter: async () => ({}),
          sendSmallLabelSet: async (_sdk: any, settings: any, labels: any[]) => {
            sent++;
            assert.equal(settings.roll, 'Right');
            assert.deepEqual(labels.map(l => l.heading), ['MEAT TAG', 'CRATE LABEL', 'CRATE LABEL']);
            if (scenario === 'uncertain') throw new printing.UncertainLabelPrintError('Check printer');
            return labels.length;
          },
        },
      };
      const module: any = { exports: {} };
      new Function('require', 'module', 'exports', code)((name: string) => deps[name], module, module.exports);
      const tree = module.exports.default({ job, disabled: scenario === 'disabled', saveFirst: scenario === 'unsaved' });
      const nodes: any[] = [];
      const visit = (node: any) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(visit); return; } nodes.push(node); visit(node.props?.children); };
      visit(tree);
      const button = nodes.find(n => n.type === 'button');
      button.props.onClick();
      if (scenario === 'double-click') button.props.onClick();
      for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
      assert.equal(sent, ['success', 'double-click', 'uncertain'].includes(scenario) ? 1 : 0, scenario);
      if (scenario === 'unsaved' || scenario === 'disabled') assert.equal(loaded, 0, scenario);
      if (scenario === 'uncertain') assert.equal(states[3], true, 'Uncertain jobs lock further printing');
    }
  } finally { globalThis.fetch = oldFetch; }
}
