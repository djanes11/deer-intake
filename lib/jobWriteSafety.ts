import type { Job } from '@/types/job';

export const JOB_CONFLICT = 'This deer was changed by another station. Reload it from Search before saving again.';

export class JobWriteError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

// Operational controls may change only their own fields, never a full intake snapshot.
const PATCH_FIELDS = new Set([
  'tag', 'id', 'updatedAt', 'callNotes', 'status', 'capingStatus', 'webbsStatus', 'specialtyStatus',
  'amountPaidProcessing', 'amountPaidSpecialty', 'paidProcessing', 'paidSpecialty',
  'paymentMethodProcessing', 'paymentMethodSpecialty',
  'pickedUpProcessing', 'pickedUpProcessingAt', 'pickedUpCape', 'pickedUpCapeAt',
  'pickedUpWebbs', 'pickedUpWebbsAt', 'pickedUpBy', 'pickupNotes',
]);

export function validateJobPatch(job: Partial<Job>) {
  if (Object.keys(job).some((key) => !PATCH_FIELDS.has(key))) {
    throw new JobWriteError('Use the intake editor to change customer or order details.', 400);
  }
}

export function requireFreshJob(job: Partial<Job>, existing: Job, mode: 'update' | 'patch') {
  if (mode === 'update' && (!job.id || !job.updatedAt)) {
    throw new JobWriteError('Reload this intake before editing it. A saved record and version are required.');
  }
  if (job.id && job.id !== existing.id) throw new JobWriteError(JOB_CONFLICT);
  if (job.updatedAt && job.updatedAt !== existing.updatedAt) throw new JobWriteError(JOB_CONFLICT);
  if (job.tag !== existing.tag) throw new JobWriteError('The tag has changed. Reopen this deer from Search.');
}

/** Keep operational writes out of customer, price, order, and notification columns. */
export function operationalPayload(job: Partial<Job>, computed: Record<string, any>) {
  const columns = new Set(['tag']);
  const direct: Record<string, string> = {
    callNotes: 'call_notes', status: 'status', capingStatus: 'caping_status',
    webbsStatus: 'webbs_status', specialtyStatus: 'specialty_status',
    pickedUpBy: 'picked_up_by', pickupNotes: 'pickup_notes',
  };
  for (const [field, column] of Object.entries(direct)) if (Object.hasOwn(job, field)) columns.add(column);
  for (const [track, suffix, status] of [
    ['Processing', 'processing', 'status'], ['Cape', 'cape', 'capingStatus'], ['Webbs', 'webbs', 'webbsStatus'],
  ]) {
    if (Object.hasOwn(job, `pickedUp${track}`) || Object.hasOwn(job, `pickedUp${track}At`) || String((job as any)[status]).toLowerCase() === 'picked up') {
      columns.add(`picked_up_${suffix}`); columns.add(`picked_up_${suffix}_at`);
    }
  }
  for (const [track, suffix] of [['Processing', 'processing'], ['Specialty', 'specialty']]) {
    if (['amountPaid', 'paid', 'paymentMethod'].some((prefix) => Object.hasOwn(job, prefix + track))) {
      for (const column of [`amount_paid_${suffix}`, `paid_${suffix}`, `payment_method_${suffix}`, `paid_${suffix}_at`, 'paid']) columns.add(column);
    }
  }
  return Object.fromEntries([...columns].filter((key) => computed[key] !== undefined).map((key) => [key, computed[key]]));
}

export async function persistJobRecord(supabase: any, args: {
  jobId: string | null;
  processorId: string | null;
  expectedUpdatedAt: string | null;
  payload: Record<string, any>;
  specialtyItems: any[] | null;
}) {
  const { data, error } = await supabase.rpc('save_job_guarded', {
    p_job_id: args.jobId,
    p_processor_id: args.processorId,
    p_expected_updated_at: args.expectedUpdatedAt,
    p_payload: args.payload,
    p_specialty_items: args.specialtyItems,
  });
  if (error) {
    if (error.code === '40001') throw new JobWriteError(JOB_CONFLICT);
    if (error.code === '23505' && args.payload.requires_tag !== true) {
      throw new JobWriteError('Tag or confirmation already in use. Open the existing deer from Search, or use a different tag/confirmation.');
    }
    throw error;
  }
  if (!data?.id) throw new JobWriteError(JOB_CONFLICT);
  return data;
}
