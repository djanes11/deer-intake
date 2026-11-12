import { JobWriteError, JOB_CONFLICT } from '@/lib/jobWriteSafety';
import { normalizeTagInput, validateTag, type IdentifierSettings } from '@/lib/identifiers';

/** One conditional write: never upsert or resave a full intake to correct a tag. */
export async function correctJobTag(supabase: any, input: {
  processorId: string; role: string | null; jobId: string; oldTag: string;
  newTag: string; updatedAt: string; identifiers: IdentifierSettings;
}) {
  if (!input.processorId || input.role !== 'admin') throw new JobWriteError('Only admins can correct tags.', 403);
  if (!input.jobId || !input.oldTag || !input.updatedAt) throw new JobWriteError('Reopen this intake before correcting its tag.', 400);
  const tag = input.newTag.trim();
  if (tag !== normalizeTagInput(tag, input.identifiers) || /^PENDING-/i.test(tag)) {
    throw new JobWriteError('Enter a valid tag using the configured tag format.', 400);
  }
  const invalid = validateTag(tag, input.identifiers);
  if (invalid) throw new JobWriteError(invalid, 400);
  if (tag === input.oldTag) throw new JobWriteError('Enter a different tag.', 400);

  // The existing processor/tag unique index resolves simultaneous duplicate claims.
  // The existing write-version trigger invalidates other open intake editors.
  const { data, error } = await supabase.from('jobs')
    .update({ tag, updated_at: new Date().toISOString(), intake_sheet_printed_at: null })
    .eq('id', input.jobId).eq('processor_id', input.processorId)
    .eq('tag', input.oldTag).eq('updated_at', input.updatedAt)
    .or('requires_tag.is.null,requires_tag.eq.false').is('pending_deleted_at', null)
    .select('id,tag,updated_at').maybeSingle();
  if (error?.code === '23505') throw new JobWriteError('That tag is already in use. Choose a different tag.', 409);
  if (error) throw error;
  if (!data) throw new JobWriteError(JOB_CONFLICT);
  return { id: data.id, tag: data.tag, updatedAt: data.updated_at };
}
