import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function resolveAlias(specifier) {
  const relativePath = specifier.slice(2);
  const absoluteBase = path.join(root, relativePath);
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.js`,
    path.join(absoluteBase, 'index.ts'),
    path.join(absoluteBase, 'index.tsx'),
    path.join(absoluteBase, 'index.js'),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ? pathToFileURL(match).href : null;
}

registerHooks({
  resolve(specifier, context, defaultResolve) {
    if (specifier === 'server-only') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export%20default%20undefined%3B',
      };
    }
    if (specifier === 'next/headers') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export%20async%20function%20headers()%20%7B%20return%20new%20Headers()%3B%20%7D',
      };
    }
    if (specifier.startsWith('@/')) {
      const resolved = resolveAlias(specifier);
      if (!resolved) {
        throw new Error(`Could not resolve alias import: ${specifier}`);
      }
      return defaultResolve(resolved, context, defaultResolve);
    }
    return defaultResolve(specifier, context, defaultResolve);
  },
});
