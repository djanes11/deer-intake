'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logCallSimple, markCalled } from '@/lib/api';

type Track = 'meat' | 'cape' | 'specialty' | 'webbs';

function trackLabel(track: Track) {
  if (track === 'meat') return 'Meat';
  if (track === 'cape') return 'Cape';
  if (track === 'specialty') return 'Specialty';
  return 'Webbs';
}

export default function ContactWatchActions({
  tag,
  track,
  contactMethod,
  canUpdate,
}: {
  tag: string;
  track: Track;
  contactMethod: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'attempt' | 'contacted' | ''>('');
  const disabled = !canUpdate || !tag || contactMethod === 'Missing' || !!busy;
  const disabledTitle = !canUpdate
    ? 'Only Staff or Admin can update customer contact.'
    : contactMethod === 'Missing'
      ? 'Add usable contact information before marking this handled.'
      : undefined;

  async function run(action: 'attempt' | 'contacted') {
    setBusy(action);
    try {
      if (action === 'attempt') {
        await logCallSimple({
          tag,
          scope: track,
          reason: `${trackLabel(track)} contact attempt`,
          notes: `${contactMethod} attempt logged from Needs Contact`,
        });
      } else {
        await markCalled({
          tag,
          scope: track,
          notes: `${contactMethod} contact confirmed from Needs Contact`,
        });
      }
      router.refresh();
    } catch (error: any) {
      alert(error?.message || 'Could not update contact status.');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn secondary small"
        disabled={disabled}
        title={disabledTitle}
        onClick={() => run('attempt')}
      >
        {busy === 'attempt' ? 'Saving...' : '+1 Attempt'}
      </button>
      <button
        type="button"
        className="btn small"
        disabled={disabled}
        title={disabledTitle}
        onClick={() => run('contacted')}
      >
        {busy === 'contacted' ? 'Saving...' : 'Mark Contacted'}
      </button>
    </>
  );
}
