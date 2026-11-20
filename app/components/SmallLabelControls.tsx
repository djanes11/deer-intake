'use client';

import { useEffect, useRef, useState } from 'react';
import { getJob } from '@/lib/api';
import { antlerData, directAntlerEligible, sendAntlerLabel } from '@/lib/antlerLabelPrinting';
import {
  buildSmallLabelSet, connectSmallLabelPrinter, readSmallLabelSettings, saveSmallLabelSettings,
  sendSmallLabelSet, smallLabelData, UncertainLabelPrintError,
} from '@/lib/smallLabelPrinting';

export default function SmallLabelControls({ job, disabled = false, saveFirst = false, brandingName = 'Wild Game Butcher Board' }: {
  job: Record<string, any> | null | undefined;
  disabled?: boolean;
  saveFirst?: boolean;
  brandingName?: string;
}) {
  const [crates, setCrates] = useState<2 | 3>(2);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const working = useRef(false);
  const tag = smallLabelData(job || {}).tag;
  useEffect(() => { setCrates(readSmallLabelSettings().packages); }, []);
  useEffect(() => { if (!working.current && !uncertain) setMessage(''); }, [tag, uncertain]);

  async function authorize() {
    const response = await fetch('/api/staff/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 401) {
      window.location.replace('/staff/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));
      throw new Error('Sign in again before printing.');
    }
    if (!response.ok) throw new Error('Could not verify your staff session. No further labels were sent.');
  }
  async function print(mode: 'set' | 'meat' | 'crate' | 'antler') {
    if (working.current || disabled || saveFirst || uncertain) return;
    working.current = true; setBusy(true); setMessage('');
    try {
      await authorize();
      const settings = { ...readSmallLabelSettings(), packages: crates };
      if (!settings.printer) throw new Error('Open Printer setup below and select this computer’s Twin Turbo and small-label roll first.');
      const displayed = smallLabelData(job || {});
      buildSmallLabelSet(displayed, crates);
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
      const labels = buildSmallLabelSet(current, crates);
      const selected = mode === 'set' ? labels : [mode === 'meat' ? labels[0] : labels[1]];
      const count = await sendSmallLabelSet(await connectSmallLabelPrinter(), settings, selected, authorize);
      setMessage(`Tag ${current.tag}: ${count} label request(s) accepted by DYMO. Check the printed labels.`);
    } catch (error) {
      if (error instanceof UncertainLabelPrintError) setUncertain(true);
      setMessage(error instanceof Error ? error.message : 'Could not print labels.');
    } finally { working.current = false; setBusy(false); }
  }
  function changeCount(value: 2 | 3) {
    setCrates(value);
    try { saveSmallLabelSettings({ ...readSmallLabelSettings(), packages: value }); }
    catch { setMessage('Crate count changed for this page; browser settings could not be saved.'); }
  }
  const locked = busy || disabled || saveFirst || uncertain || !tag || /^pending/i.test(tag);
  return <div style={{ flexBasis: '100%', minWidth: 0, display: 'grid', gap: 8, marginTop: 8 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="btn secondary" type="button" disabled={locked} onClick={() => void print('set')}>
        {busy ? 'Sending labels…' : `Print Meat + ${crates} Crate Labels`}
      </button>
      {directAntlerEligible(job) ? <button className="btn secondary" type="button" disabled={locked} onClick={() => void print('antler')}>Print Antler — DYMO</button> : null}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        Crates
        <select aria-label="Crate labels per deer" value={crates} disabled={busy || uncertain} onChange={event => changeCount(Number(event.target.value) as 2 | 3)} style={{ width: 'auto', padding: '6px 8px' }}>
          <option value={2}>2</option><option value={3}>3</option>
        </select>
      </label>
      <a href="/staff/label-printing" style={{ fontSize: 13 }}>Printer setup</a>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Individual labels</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <button className="btn secondary" type="button" disabled={locked} onClick={() => void print('meat')}>1 Meat Tag</button>
          <button className="btn secondary" type="button" disabled={locked} onClick={() => void print('crate')}>1 Crate Label</button>
        </div>
      </details>
    </div>
    {saveFirst ? <div style={{ fontSize: 13 }}>Save this intake before printing labels.</div> : null}
    {message ? <div role="status" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{message}</div> : null}
    {uncertain ? <button className="btn secondary" type="button" disabled={busy} onClick={() => { setUncertain(false); setMessage('Print only the missing labels using Individual labels.'); }}>I checked the printer and queue — unlock printing</button> : null}
  </div>;
}
