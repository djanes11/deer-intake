'use client';

import { useState } from 'react';
import { normalizeTagInput, tagInputMode, validateTag, type IdentifierSettings } from '@/lib/identifiers';

export default function TagCorrection({ job, identifiers, disabled, onBusyChange }: {
  job: { id: string; tag: string; updatedAt: string };
  identifiers: IdentifierSettings; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function correct() {
    if (disabled || saving) return;
    const invalid = validateTag(newTag, identifiers);
    if (invalid || newTag === job.tag) { setError(invalid || 'Enter a different tag.'); return; }
    if (!window.confirm(`Change tag ${job.tag} to ${newTag}? Replace the printed intake and any labels on this deer. The old barcode will no longer identify this deer.`)) return;
    setSaving(true); onBusyChange(true); setError('');
    try {
      const response = await fetch('/api/v2/jobs/correct-tag', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, oldTag: job.tag, newTag, updatedAt: job.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.job?.tag) throw new Error(result.error || 'Could not confirm the correction. Reopen this deer from Search.');
      if (result.warning) window.alert(result.warning);
      // Reload the authoritative record; never keep a stale printable snapshot.
      window.location.replace(`/intake?tag=${encodeURIComponent(result.job.tag)}&tagCorrected=1`);
    } catch (err: any) {
      setError(err?.message || 'Could not confirm the correction. Reopen this deer from Search before retrying.');
      setSaving(false); onBusyChange(false);
    }
  }
  return <div style={{ marginTop: 8 }}>
    {!open ? <button type="button" className="btn secondaryBtn" disabled={disabled} onClick={() => { setOpen(true); setNewTag(''); setError(''); }}>Correct tag</button> : <div>
      <label htmlFor="correct-tag">Corrected {identifiers.tagLabel}</label>
      <input id="correct-tag" value={newTag} disabled={disabled || saving} inputMode={tagInputMode(identifiers)} onChange={e => setNewTag(normalizeTagInput(e.target.value, identifiers))} />
      <p style={{ fontSize: 12 }}>Correcting {job.tag}. Replace the intake sheet and labels after saving; the old barcode will no longer identify this deer.</p>
      <button type="button" className="btn" disabled={disabled || saving || !newTag} onClick={correct}>{saving ? 'Correcting…' : 'Save corrected tag'}</button>
      <button type="button" className="btn secondaryBtn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>}
    {disabled && !saving ? <div className="muted" style={{ fontSize: 12 }}>Save other intake changes before correcting the tag.</div> : null}
  </div>;
}
