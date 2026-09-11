import { run as runIdentifiers } from './identifiers.test.ts';
import { run as runSiteSettings } from './site-settings.test.ts';
import { run as runProcessorCatalog } from './processor-catalog.test.ts';
import { run as runSpecialty } from './specialty.test.ts';
import { run as runPublicIntakeSafety } from './public-intake-safety.test.ts';
import { run as runStateForms } from './stateforms.test.ts';
import { run as runJobWriteSafety } from './job-write-safety.test.ts';
import { run as runDatabaseSafety } from './database-safety.test.ts';
import { run as runClientWrites } from './client-writes.test.ts';
import { run as runReadiness } from './readiness.test.ts';

const suites = [
  ['identifiers', runIdentifiers],
  ['site settings', runSiteSettings],
  ['processor catalog', runProcessorCatalog],
  ['specialty', runSpecialty],
  ['public intake safety', runPublicIntakeSafety],
  ['state forms', runStateForms],
  ['job write safety', runJobWriteSafety],
  ['database safety', runDatabaseSafety],
  ['client writes', runClientWrites],
  ['readiness', runReadiness],
] as const;

for (const [label, fn] of suites) {
  await fn();
  console.log(`smoke ok: ${label}`);
}
