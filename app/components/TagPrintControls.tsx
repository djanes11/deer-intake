'use client';

import { useRef, useState } from 'react';
import { canPrintAntlerLabel } from './ThermalLabelSheet';
import { emptyDymoSettings, getDymo, labelArtwork, labelData, listDymoPrinters, readDymoSettings, saveDymoSettings, sendDymoLabels, validateTemplate, type DymoPrinter, type DymoSettings, type LabelKind } from '@/lib/dymoPrinting';

let printingOnThisPage = false;
export default function TagPrintControls({ job, prepareJob, onBrowserPrint, disabled, brandingName }: {
  job: Record<string, any> | null;
  prepareJob: () => Promise<Record<string, any> | null>;
  onBrowserPrint: (kind: LabelKind) => void | Promise<void>;
  disabled?: boolean;
  brandingName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [setup, setSetup] = useState(false);
  const [settings, setSettings] = useState<DymoSettings>(emptyDymoSettings);
  const [printers, setPrinters] = useState<DymoPrinter[]>([]);
  const [preview, setPreview] = useState('');
  const lock = useRef(false);
  const eligible = canPrintAntlerLabel(job);
  function downloadArtwork(kind: LabelKind) {
    const image = labelArtwork({ tag: '999999', customer: 'TEST LABEL - NOT A DEER', phone: '555-555-0100', confirmation: '123456789012345', processType: 'Caped' }, kind, brandingName || '');
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image}`; link.download = `${kind === 'deer' ? 'meat' : 'antler'}-template-artwork.png`; link.click();
  }
  async function print(mode: LabelKind | 'both', test = false) {
    if (lock.current || printingOnThisPage) return;
    lock.current = true; printingOnThisPage = true; setBusy(true); setMessage('');
    try {
      const config = test ? settings : readDymoSettings();
      if (!config.printer) {
        if (mode === 'both' || test) throw new Error('Open Label printer setup to choose the Twin Turbo and load both templates.');
        await onBrowserPrint(mode); return;
      }
      const record = test ? { tag: '999999', customer: 'TEST LABEL - NOT A DEER', phone: '555-555-0100', confirmation: '123456789012345', processType: 'Caped' } : await prepareJob();
      if (!record) return;
      if (!test && mode !== 'deer' && !canPrintAntlerLabel(record)) throw new Error('This processing selection does not need an antler tag.');
      const kinds: LabelKind[] = mode === 'both' ? ['deer', 'antler'] : [mode];
      const labels = kinds.map(kind => ({ kind, image: labelArtwork(record, kind, brandingName || '') }));
      setPreview(`data:image/png;base64,${labels[0].image}`);
      await sendDymoLabels(await getDymo(), config, labels, labelData(record).tag);
      setMessage(`${mode === 'both' ? 'Meat and antler labels' : mode === 'deer' ? 'Meat label' : 'Antler label'} sent to DYMO. Check the physical labels.`);
    } catch (e: any) { setMessage(e?.message || 'Could not prepare labels.'); }
    finally { lock.current = false; printingOnThisPage = false; setBusy(false); }
  }
  async function loadTemplate(file: File | undefined, kind: LabelKind) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a template smaller than 2 MB.');
      const xml = await file.text(); validateTemplate(xml);
      setSettings(s => ({ ...s, [kind === 'deer' ? 'meatTemplate' : 'antlerTemplate']: xml }));
      setMessage(`${kind === 'deer' ? 'Meat' : 'Antler'} template loaded. Test it before saving setup.`);
    } catch (e: any) { setMessage(e.message); }
  }
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
    <button className="btn secondary" type="button" disabled={disabled || busy} onClick={() => void print('deer')}>Meat Tag</button>
    {eligible && <>
      <button className="btn secondary" type="button" disabled={disabled || busy} onClick={() => void print('antler')}>Antler Tag</button>
      <button className="btn" type="button" disabled={disabled || busy} onClick={() => void print('both')}>{busy ? 'Preparing labels…' : 'Meat + Antler (DYMO)'}</button>
    </>}
    <button className="btn secondary" type="button" disabled={busy} onClick={() => { setSettings(readDymoSettings()); setSetup(!setup); }}>Label printer setup</button>
    {message && <div role="status" style={{ width: '100%', overflowWrap: 'anywhere' }}>{message}</div>}
    {setup && <div style={{ width: '100%', padding: 16, border: '1px solid #888', borderRadius: 10, display: 'grid', gap: 12 }}>
      <strong>DYMO Twin Turbo — this computer/browser only</strong>
      <p>Install and start DYMO Connect on the computer connected to the printer. Printing still starts here in the web app. Allow local-network access if your browser asks.</p>
      <button type="button" className="btn secondary" disabled={busy} onClick={async () => {
        setBusy(true); setMessage('Looking for DYMO printers…');
        try { const found = await listDymoPrinters(); setPrinters(found); setMessage(found.length ? 'Choose your printer below.' : 'No local Twin Turbo found. Check USB, power, and DYMO Connect.'); }
        catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
      }}>Find Twin Turbo</button>
      <label>Printer <select value={settings.printer} onChange={e => setSettings(s => ({ ...s, printer: e.target.value }))}>
        <option value="">Browser print dialog (individual labels only)</option>
        {settings.printer && !printers.some(p => p.name === settings.printer) && <option value={settings.printer}>{settings.printer} (saved; reconnect to verify)</option>}
        {printers.map(p => <option key={p.name} value={p.name}>{p.name}{p.isConnected ? '' : ' (offline)'}</option>)}
      </select></label>
      <label>Small meat-label roll <select value={settings.meatRoll} onChange={e => setSettings(s => ({ ...s, meatRoll: e.target.value as 'Left' | 'Right' }))}><option>Left</option><option>Right</option></select></label>
      <div>Large antler labels use the {settings.meatRoll === 'Left' ? 'right' : 'left'} roll. Automatic roll switching is never used.</div>
      <p>In DYMO Connect, select your actual label stock and orientation: meat 2″ wide × 1″ tall; antler 59 × 102 mm, portrait. Add one image object, name it <strong>ARTWORK</strong> in its properties, stretch it over the printable area without changing its proportions, and save the label. Load each saved .dymo or .label file here. The app fills that image with the deer’s details.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn secondary" onClick={() => downloadArtwork('deer')}>Download sample meat image</button>
        <button type="button" className="btn secondary" onClick={() => downloadArtwork('antler')}>Download sample antler image</button>
      </div>
      <label>Meat template {settings.meatTemplate ? '(loaded)' : ''}<input type="file" accept=".dymo,.label" onChange={e => void loadTemplate(e.target.files?.[0], 'deer')} /></label>
      <label>Antler template {settings.antlerTemplate ? '(loaded)' : ''}<input type="file" accept=".dymo,.label" onChange={e => void loadTemplate(e.target.files?.[0], 'antler')} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn secondary" disabled={busy || !settings.printer || !settings.meatTemplate} onClick={() => void print('deer', true)}>Print test meat tag</button>
        <button type="button" className="btn secondary" disabled={busy || !settings.printer || !settings.antlerTemplate} onClick={() => void print('antler', true)}>Print test antler tag</button>
        <button type="button" className="btn" disabled={busy} onClick={() => {
          try { saveDymoSettings(settings); setMessage('Printer setup saved on this browser.'); setSetup(false); }
          catch { setMessage('Could not save printer setup. Check that browser storage is enabled.'); }
        }}>Save printer setup</button>
      </div>
      <p>Before using for customers: verify each test uses the correct roll, all text fits, and the antler barcode scans. A submitted print job is not proof that a physical label printed.</p>
      {preview && <img src={preview} alt="Last prepared label artwork" style={{ maxWidth: '100%', width: 220, border: '1px solid #888' }} />}
    </div>}
  </div>;
}
