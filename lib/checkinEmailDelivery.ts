/** Reserve one automatic check-in email per deer, across requests and servers.
 * A timeout may occur after SMTP accepted the message. Never release a reserved
 * attempt automatically: an explicit staff resend remains the recovery path.
 */
export async function sendCheckinEmailOnce(
  supabase: any,
  job: { id: string; processor_id?: string | null },
  send: () => Promise<unknown>,
): Promise<boolean> {
  if (!job.id) throw new Error('A saved deer is required for a check-in email.');
  const { error } = await supabase.from('job_checkin_email_delivery').insert({
    job_id: job.id, processor_id: job.processor_id || null, state: 'sending',
  });
  if (error?.code === '23505') return false;
  if (error) throw new Error('Check-in email could not be reserved. Verify sql/2026-11-11-checkin-email-deduplication.sql is applied.');

  let accepted = false;
  try {
    await send();
    accepted = true;
  } finally {
    // Keep the reservation even if this bookkeeping fails or the worker stops.
    // Do not turn an accepted email into an automatic retry.
    try {
      const { error: trackingError } = await supabase.from('job_checkin_email_delivery')
        .update({ state: accepted ? 'sent' : 'uncertain', sent_at: accepted ? new Date().toISOString() : null })
        .eq('job_id', job.id);
      if (trackingError) console.error('Check-in email tracking update failed', trackingError);
    } catch (trackingError) {
      console.error('Check-in email tracking update failed', trackingError);
    }
  }
  return true;
}
