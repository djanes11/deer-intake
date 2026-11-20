'use client';

import { useEffect, useRef, useState } from 'react';
import { getJob } from '@/lib/api';
import { antlerData, directAntlerEligible, sendAntlerLabel } from '@/lib/antlerLabelPrinting';
import {
  buildSmallLabelSet, connectSmallLabelPrinter, readSmallLabelSettings,
  sendSmallLabelSet, smallLabelData, UncertainLabelPrintError,
} from '@/lib/smallLabelPrinting';

export default function SmallLabelControls({ job, disabled = false, saveFirst = false, brandingName = 'Wild Game Butcher Board', buttonClassName = 'btn secondary' }: {
  job: Record<string, any> | null | undefined;
  disabled?: boolean;
  saveFirst?: boolean;
  brandingName?: string;
  buttonClassName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const working = useRef(false);
  const tag = smallLabelData(job || {}).tag;
  useEffect(() => { if (!working.current && !uncertain) setMessage(''); }, [tag, uncertain]);

  async function authorize() {
    const response = await fetch('/api/staff/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 401) {
      window.location.replace('/staff/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      throw new Error('Sign in again before printing.');
    }
    if (!response.ok) throw new Error('Could not verify your staff session. No further labels were sent.');
  }
  async function print(mode: 'meat' | 'crate' | 'antler') {
    if (working.current || disabled || saveFirst || uncertain) return;
    working.current = true; setBusy(true); setMessage('');
    try {
      await authorize();
      const settings = readSmallLabelSettings();
      if (!settings.printer) throw new Error('Open Help → Printer Setup and select this computer’s Twin Turbo and small-label roll first.');
      const displayed = smallLabelData(job || {});
      buildSmallLabelSet(displayed, 2);
      const result = await getJob(displayed.tag);
      if (!result.job) throw new Error('Could not load the saved deer. Refresh before printing.');
      const current = smallLabelData(result.job);
      if ((job?.id && result.job.id !== job.id) || JSON.stringify(current) !== JSON.stringify(displayed)) {
        throw new Error('The saved deer details have changed. Refresh this record and review it before printing.');
      }
      if (mode === 'antler') {
        if (JSON.stringify(antlerData(result.job)) !== JSON.stringify(antlerData(job || {}))) {
          throw new Error('The antler details changed. Refresh this record before printing.');
        }
        await sendAntlerLabel(await connectSmallLabelPrinter(), settings, result.job, brandingName, authorize);
        setMessage(`Tag ${current.tag}: antler label sent to the ${settings.roll === 'Left' ? 'right' : 'left'} roll. Check the printed label.`);
        return;
      }
      const labels = buildSmallLabelSet(current, 2);
      const selected = [mode === 'meat' ? labels[0] : labels[1]];
      const count = await sendSmallLabelSet(await connectSmallLabelPrinter(), settings, selected, authorize);
      setMessage(`Tag ${current.tag}: ${count} label request(s) accepted by DYMO. Check the printed labels.`);
    } catch (error) {
      if (error instanceof UncertainLabelPrintError) setUncertain(true);
      setMessage(error instanceof Error ? error.message : 'Could not print labels.');
    } finally { working.current = false; setBusy(false); }
  }
  const locked = busy || disabled || saveFirst || uncertain || !tag || /^pending/i.test(tag);
  const title = saveFirst ? 'Save this intake before printing labels.' : 'Print one label using the saved printer setup';
  return <>
    <button className={buttonClassName} title={title} type="button" disabled={locked} onClick={() => void print('meat')}>{busy ? 'Sending…' : 'Meat Tag'}</button>
    <button className={buttonClassName} title={title} type="button" disabled={locked} onClick={() => void print('crate')}>Crate Label</button>
    {directAntlerEligible(job) ? <button className={buttonClassName} title={title} type="button" disabled={locked} onClick={() => void print('antler')}>Antler Tag — DYMO</button> : null}
    {message ? <div role="status" style={{ flexBasis: '100%', fontSize: 13, overflowWrap: 'anywhere' }}>{message}</div> : null}
    {uncertain ? <button className={buttonClassName} type="button" disabled={busy} onClick={() => { setUncertain(false); setMessage('Print only the missing labels.'); }}>I checked the printer and queue — unlock printing</button> : null}
  </>;
}
