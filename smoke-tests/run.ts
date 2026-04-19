import { run as runIdentifiers } from './identifiers.test.ts';
import { run as runSiteSettings } from './site-settings.test.ts';
import { run as runProcessorCatalog } from './processor-catalog.test.ts';

const suites = [
  ['identifiers', runIdentifiers],
  ['site settings', runSiteSettings],
  ['processor catalog', runProcessorCatalog],
] as const;

for (const [label, fn] of suites) {
  fn();
  console.log(`smoke ok: ${label}`);
}
