'use client';

import { useEffect, useRef, useState } from 'react';
import { getJob } from '@/lib/api';
import {
  buildSmallLabelSet, connectSmallLabelPrinter, defaultSmallLabelSettings, readSmallLabelSettings,
  saveSmallLabelSettings, sendSmallLabelSet, smallLabelData, smallLabelPrinters, UncertainLabelPrintError,
  type LabelPrinter, type SmallLabelData, type SmallLabelSettings,
} from '@/lib/smallLabelPrinting';

const SAMPLE: SmallLabelData = { customer: 'Sample Customer', tag: 'TEST-10001', phone: '(555) 555-0100' };

export default function LabelPrintingTestPage() {
  const [settings, setSettings] = useState<SmallLabelSettings>({ ...defaultSmallLabelSettings });
  const [printers, setPrinters] = useState<LabelPrinter[]>([]);
  const [tag, setTag] = useState('');
  const [data, setData] = useState<SmallLabelData>(SAMPLE);
  const [sample, setSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const working = useRef(false);
  useEffect(() => { setSettings(readSmallLabelSettings()); }, []);

  async function authorize() {
    const response = await fetch('/api/staff/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 401) {
      window.location.replace('/staff/login?next=%2Fstaff%2Flabel-printing');
      throw new Error('Your session expired. Sign in before printing.');
    }
    if (!response.ok) throw new Error('Unable to verify your staff session. Nothing further will be sent.');
  }
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage('');
    try { await authorize(); await action(); }
    catch (error) {
      if (error instanceof UncertainLabelPrintError) setUncertain(true);
      setMessage(error instanceof Error ? error.message : 'The operation could not be completed.');
    } finally { working.current = false; setBusy(false); }
  }
  function updateSettings(change: Partial<SmallLabelSettings>) {
    const next = { ...settings, ...change };
    setSettings(next);
    try { saveSmallLabelSettings(next); }
    catch { setMessage('This browser could not save your printer preferences. They will last only until you leave this page.'); }
  }
  async function findPrinters() {
    const found = await smallLabelPrinters(await connectSmallLabelPrinter());
    setPrinters(found);
    if (!found.length) throw new Error('No connected Twin Turbo found. Check the USB connection and DYMO service on this computer.');
    if (!found.some(p => p.name === settings.printer)) updateSettings({ printer: found[0].name });
    setMessage('Twin Turbo found. Confirm which side holds the small labels, then print one test label.');
  }
  async function loadJob() {
    // Clear any previous customer first so failed searches cannot print stale data.
    setData(SAMPLE); setSample(true);
    const result = await getJob(tag.trim());
    if (!result.job) throw new Error('No deer found for that tag.');
    const next = smallLabelData(result.job);
    buildSmallLabelSet(next, settings.packages);
    setData(next); setSample(false);
    setMessage('Deer loaded. Review the name, tag number and phone below.');
  }
  async function print(mode: 'test' | 'meat' | 'package') {
    if (uncertain) return;
    let current = mode === 'test' ? SAMPLE : data;
    if (mode !== 'test' && !sample) {
      const result = await getJob(data.tag);
      if (!result.job) throw new Error('This deer could not be refreshed. Load the record again.');
      current = smallLabelData(result.job);
      if (JSON.stringify(current) !== JSON.stringify(data)) {
        setData(current);
        throw new Error('The deer details changed. Review the updated preview before printing.');
      }
    }
    const labels = buildSmallLabelSet(current, settings.packages);
    const selected = [mode === 'package' ? labels[1] : labels[0]];
    const count = await sendSmallLabelSet(await connectSmallLabelPrinter(), settings, selected, authorize);
    setMessage(`${count} label request(s) accepted by DYMO. Check the physical labels before using them. No deer status was changed.`);
  }
  return (
    <main className="label-lab">
      <h1>Printer Setup</h1>
      <p>Save this computer’s Twin Turbo and small-label roll here. Meat and crate buttons print one small label per click; antler tags use the opposite roll.</p>
      <p className="notice">Small labels: DYMO 30336. Check one sample label after changing the printer or roll. Crate labels have blank spaces for staff to write the crate count after cutting.</p>
      <fieldset disabled={busy}>
        <legend>Printer setup — saved on this computer</legend>
        <button type="button" onClick={() => void run(findPrinters)}>Find Twin Turbo</button>
        <label>Printer<select value={settings.printer} onChange={event => updateSettings({ printer: event.target.value })}>
          <option value="">Select printer</option>
          {settings.printer && !printers.some(p => p.name === settings.printer) ? <option value={settings.printer}>{settings.printer} (saved; connection not checked)</option> : null}
          {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select></label>
        <div className="options">
          <label>Small-label roll<select value={settings.roll} onChange={event => updateSettings({ roll: event.target.value as 'Left' | 'Right' })}><option>Left</option><option>Right</option></select></label>
        </div>
        <button type="button" disabled={!settings.printer || uncertain} onClick={() => void run(() => print('test'))}>Print 1 sample meat tag</button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Choose a deer</legend>
        <form onSubmit={event => { event.preventDefault(); void run(loadJob); }} className="options">
          <label>Deer tag number<input value={tag} onChange={event => setTag(event.target.value)} placeholder="Enter assigned tag" /></label>
          <button type="submit" disabled={!tag.trim()}>Load deer</button>
          <button type="button" onClick={() => { setData(SAMPLE); setSample(true); setTag(''); setMessage('Showing sample details.'); }}>Use sample details</button>
        </form>
        <p>{sample ? 'Sample details — no customer record selected.' : `Loaded deer: ${data.tag}`}</p>
        <div className="previews">
          {(['MEAT TAG', 'CRATE LABEL'] as const).map(heading => (
            <div key={heading}>
              <div className={`label-preview ${heading === 'CRATE LABEL' ? 'crate' : 'meat'}`}>
                <div className="kind">{heading}</div>
                <strong className="tag">TAG {data.tag}</strong>
                <div className="customer">{data.customer}</div>
                <div className="phone">{data.phone}</div>
                {heading === 'CRATE LABEL' ? <div className="crate-count">CRATE ____ OF ____</div> : null}
              </div>
              <p>1 copy</p>
            </div>
          ))}
        </div>
        <p className="muted">Layout preview. Actual fit and print quality must be checked on your labels.</p>
        <div className="options">
          <button type="button" disabled={!settings.printer || uncertain} onClick={() => void run(() => print('meat'))}>Meat tag only</button>
          <button type="button" disabled={!settings.printer || uncertain} onClick={() => void run(() => print('package'))}>1 crate label only</button>
        </div>
      </fieldset>
      <div role="status" aria-live="polite" className="notice">{busy ? 'Working…' : message || 'Ready to connect. No labels print until you choose a print button.'}</div>
      {uncertain ? <button disabled={busy} type="button" onClick={() => { setUncertain(false); setMessage('Use the individual buttons to print only missing labels.'); }}>I checked the labels and print queue — unlock printing</button> : null}
      <details><summary>If the printer connection fails</summary><p>This must run on the computer attached to the Twin Turbo. DYMO Connect’s local service must be running. If you see the earlier SSL or framework error, the connection still needs repair on that computer; this page does not bypass it. No browser print dialog is used.</p><a href="https://github.com/dymosoftware/dymo-connect-framework" target="_blank" rel="noreferrer">Official DYMO connection support</a></details>
      <style jsx>{`
        .label-lab{max-width:900px;margin:24px auto;padding:0 16px 32px}h1{font-size:26px}p{line-height:1.5}
        fieldset{min-width:0;margin:20px 0;border:1px solid #777;border-radius:12px;padding:16px}legend{font-weight:700;padding:0 8px}
        label{display:grid;gap:6px;margin:12px 0;min-width:0}select,input{width:100%;max-width:100%;padding:10px;border-radius:6px;font:inherit}
        button{padding:10px 14px;cursor:pointer;border-radius:7px;font:inherit}button:disabled{opacity:.5;cursor:default}
        .options{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.options label{flex:1;min-width:160px}
        .previews{display:flex;gap:24px;flex-wrap:wrap;margin-top:16px}.previews p{margin:6px 0}
        .label-preview{box-sizing:border-box;width:288px;height:144px;padding:7px 12px;background:white;color:black;border:1px solid #aaa;border-radius:5px;display:grid;grid-template-rows:26px 40px 32px 25px;font-family:Arial,sans-serif;overflow:hidden}
        .kind{font-size:14px;font-weight:700;border-bottom:1px solid black;margin-bottom:5px}.customer{font-size:16px;font-weight:700;line-height:17px;overflow-wrap:anywhere}.tag{font-size:25px;white-space:nowrap;align-self:center}.phone{font-size:15px}
        .crate{grid-template-rows:26px 30px 23px 19px 25px}.crate .tag{font-size:22px}.crate .customer{font-size:15px}.crate .phone{font-size:13px}.crate-count{font-size:15px;font-weight:700;align-self:end}
        .notice{padding:12px;border:1px solid #b98532;border-radius:8px;margin:16px 0;overflow-wrap:anywhere}.muted{font-size:13px;opacity:.8}details{margin-top:20px}
      `}</style>
    </main>
  );
}
