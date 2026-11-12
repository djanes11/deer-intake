import { run as runNeedsTagQueue } from './needs-tag-queue.test.ts';
import { run as runPickupQueue } from './pickup-queue.test.ts';
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
import { run as runPublicSpecialtyPrint } from './public-specialty-print.test.ts';
import { run as runStaffSessionGuard } from './staff-session-guard.test.ts';
import { run as runTagCorrection } from './tag-correction.test.ts';
import { run as runCheckinEmail } from './checkin-email.test.ts';

const suites = [
  ['needs tag queue', runNeedsTagQueue],
  ['pickup queue', runPickupQueue],
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
  ['public specialty printing', runPublicSpecialtyPrint],
  ['staff session guard', runStaffSessionGuard],
  ['admin tag correction', runTagCorrection],
  ['check-in email deduplication', runCheckinEmail],
] as const;

for (const [label, fn] of suites) {
  await fn();
  console.log(`smoke ok: ${label}`);
}
