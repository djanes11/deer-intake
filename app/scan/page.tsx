// app/scan/page.tsx — scan-only (Supabase via /api/v2/jobs)
'use client';

import React, { useState } from 'react';
import ButcherOverlay from '@/app/components/ButcherOverlay';
import { normalizeCutOptionSettings, type CutOptionSettings } from '@/lib/cutOptions';
import { useScanner } from '@/lib/useScanner';

type AnyRec = Record<string, any>;

export default function ScanPage() {
  const [lastTag, setLastTag] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [manualTag, setManualTag] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [webbsEnabled, setWebbsEnabled] = useState(true);
  const [cutOptions, setCutOptions] = useState<CutOptionSettings>(normalizeCutOptionSettings({}));

  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayJob, setOverlayJob] = useState<AnyRec | null>(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/public/site-settings', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (json?.ok) {
          setWebbsEnabled(json?.settings?.features?.webbsEnabled !== false);
          setCutOptions(normalizeCutOptionSettings(json?.settings?.cutOptions));
        }
      } catch {
        setWebbsEnabled(true);
        setCutOptions(normalizeCutOptionSettings({}));
      }
    };
    void loadSettings();
  }, []);

  const isProcessingLike = (s: any) => String(s ?? '').toLowerCase().includes('processing');
  const isFinishedLike = (s: any) => {
    const v = String(s ?? '').toLowerCase();
    return v.includes('finished') || v.includes('ready');
  };
  const nextScanGuide = [
    'Cape orders: first scan finishes cape work, second starts processing, third finishes processing.',
    'Non-cape orders: first scan starts processing, second finishes processing.',
    'If the scanner misses a tag, type it manually below and submit one scan.',
  ];

  // ===== Canon headers (kept so overlay can stay dumb) =====
  const HEADERS = [
    'Tag',
    'Confirmation #',
    'Customer',
    'Phone',
    'Email',
    'Address',
    'City',
    'State',
    'Zip',
    'County Killed',
    'Sex',
    'Process Type',
    'Drop-off Date',
    'Status',
    'Caping Status',
    'Webbs Status',
    'Burger Size',
    'Steaks per Package',
    'Beef Fat',
    'Hind Roast Count',
    'Front Roast Count',
    'Backstrap Prep',
    'Notes',
    'Webbs Order',
    'Webbs Order Form Number',
    'Webbs Pounds',
    'Price',
    'Paid',
    'Specialty Products',
    'Specialty Pounds',
    'Original Summer Sausage (lb)',
    'Summer Sausage + Cheese (lb)',
    'Jalapeno Summer Sausage + Cheddar (lb)',
    'Original Snack Stix (lb)',
    'Original Snack Stix + Cheddar (lb)',
    'Jalapeno Snack Stix + Cheddar (lb)',
    'Hind - Steak',
    'Hind - Roast',
    'Hind - Grind',
    'Hind - None',
    'Front - Steak',
    'Front - Roast',
    'Front - Grind',
    'Front - None',
    'Notified Ready At',
    'Public Token',
    'Public Link Sent At',
    'Drop-off Email Sent At',
    'Processing Price',
    'Specialty Price',
    'Paid Processing',
    'Paid Processing At',
    'Paid Specialty',
    'Paid Specialty At',
    'Picked Up - Processing',
    'Picked Up - Processing At',
    'Picked Up - Cape',
    'Picked Up - Cape At',
    'Picked Up - Webbs',
    'Picked Up - Webbs At',
    'Call Attempts',
    'Last Called At',
    'Last Called By',
    'Last Call Outcome',
    'Last Call At',
    'Call Notes',
    'Meat Attempts',
    'Cape Attempts',
    'Webbs Attempts',
    'Requires Tag',
    'Phone Last4',
  ];

  // === Toggle normalization (overlay expects booleans, not "x"/"TRUE"/etc) ===
  const truthy = (v: any) => {
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (!s || ['0', 'false', 'no', 'off', 'none', 'n/a', 'na'].includes(s)) return false;
    if (['true', 'yes', 'y', 'x', '1', '✓', '✔', 'on'].includes(s)) return true;
    const n = Number(s);
    return Number.isFinite(n) ? n > 0 : !!s;
  };

  function normalizeToggles(o: AnyRec) {
    const keys = [
      'Hind - Steak',
      'Hind - Roast',
      'Hind - Grind',
      'Hind - None',
      'Front - Steak',
      'Front - Roast',
      'Front - Grind',
      'Front - None',
      'Beef Fat',
      'Webbs Order',
      'Specialty Products',
      'Paid',
      'Paid Processing',
      'Paid Specialty',
      'Picked Up - Processing',
      'Picked Up - Cape',
      'Picked Up - Webbs',
      'Requires Tag',
    ];
    for (const k of keys) if (k in o) o[k] = truthy(o[k]);
    return o;
  }

  // ===== Supabase API (Next route) =====
  const JOBS_API = '/api/v2/jobs';
  const PUBLIC_TOKEN =
    (process.env.NEXT_PUBLIC_DEER_API_TOKEN ||
      process.env.NEXT_PUBLIC_API_TOKEN ||
      '') as string;

  async function jobsGET(params: Record<string, string>) {
    const url = new URL(JOBS_API, window.location.origin);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = {};
    if (PUBLIC_TOKEN) headers['x-api-token'] = PUBLIC_TOKEN;

    const r = await fetch(url.toString(), { method: 'GET', headers, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `GET ${params.action || ''} failed`);
    return j;
  }

  async function jobsPOST(body: any) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (PUBLIC_TOKEN) headers['x-api-token'] = PUBLIC_TOKEN;

    const r = await fetch(JOBS_API, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `POST ${body?.action || ''} failed`);
    return j;
  }

  // ===== Map Supabase Job (camelCase) → overlay row (sheet-like headers) =====
  function jobToCanon(job: AnyRec, tagFallback: string): AnyRec {
    const j = job || {};
    const out: AnyRec = {
      Tag: j.tag ?? tagFallback,

      'Confirmation #': j.confirmation ?? '',
      Customer: j.customer ?? '',
      Phone: j.phone ?? '',
      Email: j.email ?? '',
      Address: j.address ?? '',
      City: j.city ?? '',
      State: j.state ?? '',
      Zip: j.zip ?? '',

      'County Killed': j.county ?? '',
      Sex: j.sex ?? '',
      'Process Type': j.processType ?? '',
      'Drop-off Date': j.dropoff ?? '',

      Status: j.status ?? '',
      'Caping Status': j.capingStatus ?? '',
      'Webbs Status': j.webbsStatus ?? '',

      'Burger Size': j.burgerSize ?? '',
      'Steaks per Package': j.steaksPerPackage ?? '',
      'Beef Fat': j.beefFat ?? false,
      addOnItems: j.addOnItems ?? [],

      'Hind Roast Count': j.hindRoastCount ?? '',
      'Front Roast Count': j.frontRoastCount ?? '',

      'Backstrap Prep': j.backstrapPrep ?? '',

      Notes: j.notes ?? '',

      'Webbs Order': j.webbsOrder ?? false,
      'Webbs Order Form Number': j.webbsOrderFormNumber ?? '',
      'Webbs Pounds': j.webbsPounds ?? '',
      'Webbs Items': JSON.stringify(j.webbsItems ?? []),

      'Processing Price': j.priceProcessing ?? '',
      'Specialty Price': j.priceSpecialty ?? '',
      Price: j.price ?? '',

      Paid: j.paid ?? false,
      'Paid Processing': j.paidProcessing ?? false,
      'Paid Processing At': j.paidProcessingAt ?? '',
      'Paid Specialty': j.paidSpecialty ?? false,
      'Paid Specialty At': j.paidSpecialtyAt ?? '',

      'Specialty Products': j.specialtyProducts ?? false,
      specialtyItems: j.specialtyItems ?? [],
      'Specialty Pounds': j.specialtyPounds ?? '',
      'Original Summer Sausage (lb)': j.originalSummerSausageLbs ?? '',
      'Summer Sausage + Cheese (lb)': j.summerSausageCheeseLbs ?? '',
      'Jalapeno Summer Sausage + Cheddar (lb)': j.jalapenoSummerSausageCheeseLbs ?? '',
      'Original Snack Stix (lb)': j.originalSnackSticksLbs ?? '',
      'Original Snack Stix + Cheddar (lb)': j.originalSnackSticksCheeseLbs ?? '',
      'Jalapeno Snack Stix + Cheddar (lb)': j.jalapenoSnackSticksCheeseLbs ?? '',

      'Public Token': j.publicToken ?? '',
      'Public Link Sent At': j.publicLinkSentAt ?? '',
      'Drop-off Email Sent At': j.dropoffEmailSentAt ?? '',

      'Picked Up - Processing': j.pickedUpProcessing ?? false,
      'Picked Up - Processing At': j.pickedUpProcessingAt ?? '',
      'Picked Up - Cape': j.pickedUpCape ?? false,
      'Picked Up - Cape At': j.pickedUpCapeAt ?? '',
      'Picked Up - Webbs': j.pickedUpWebbs ?? false,
      'Picked Up - Webbs At': j.pickedUpWebbsAt ?? '',

      'Call Attempts': j.callAttempts ?? 0,
      'Meat Attempts': j.meatAttempts ?? 0,
      'Cape Attempts': j.capeAttempts ?? 0,
      'Webbs Attempts': j.webbsAttempts ?? 0,

      'Last Called At': j.lastCallAt ?? '',
      'Last Called By': j.lastCalledBy ?? '',
      'Last Call Outcome': j.lastCallOutcome ?? '',
      'Last Call At': j.lastCallAt ?? '',
      'Call Notes': j.callNotes ?? '',

      'Requires Tag': j.requiresTag ?? false,
    };

    // Hind/front toggles
    out['Hind - Steak'] = j.hind?.['Hind - Steak'] ?? false;
    out['Hind - Roast'] = j.hind?.['Hind - Roast'] ?? false;
    out['Hind - Grind'] = j.hind?.['Hind - Grind'] ?? false;
    out['Hind - None'] = j.hind?.['Hind - None'] ?? false;

    out['Front - Steak'] = j.front?.['Front - Steak'] ?? false;
    out['Front - Roast'] = j.front?.['Front - Roast'] ?? false;
    out['Front - Grind'] = j.front?.['Front - Grind'] ?? false;
    out['Front - None'] = j.front?.['Front - None'] ?? false;

    // Guarantee all known headers exist (keeps overlay tolerant)
    for (const h of HEADERS) if (!(h in out)) out[h] = '';
    return out;
  }

  async function fetchFullRow(tag: string): Promise<AnyRec> {
    const t = String(tag).trim();
    try {
      const res: any = await jobsGET({ action: 'get', tag: t });
      const job = res?.job;
      if (job) return normalizeToggles(jobToCanon(job, t));
      return { Tag: t };
    } catch {
      return { Tag: t };
    }
  }

  async function handleScan(code: string) {
    const tag = String(code || '').trim();
    if (!tag) return;
    setLastTag(tag);

    let next = '';
    let progressedJob: AnyRec | null = null;
    let progressedField = '';

    try {
      const res: any = await jobsPOST({ action: 'progress', tag });
      next = String(res?.nextStatus || res?.next || '').trim();
      progressedField = String(res?.progressedField || '').trim();
      progressedJob = res?.job ?? null; // progressJob may return updated job
    } catch {
      setStatus({ kind: 'err', text: `Tag ${tag}: progress failed.` });
      return;
    }

    const overlayFromProgress = progressedJob ? normalizeToggles(jobToCanon(progressedJob, tag)) : null;

    if (progressedField === 'caping_status' && isFinishedLike(next)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Cape -> Finished.` });
      setOverlayOn(false);
      setOverlayJob(null);
      return;
    }

    if (isProcessingLike(next)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Dropped Off -> Processing.` });
      setOverlayOn(true);

      const job = overlayFromProgress ?? (await fetchFullRow(tag));
      setOverlayJob(job);

      try {
        new BroadcastChannel('butcher').postMessage({ type: 'SHOW', job });
      } catch {}
      return;
    }

    if (isFinishedLike(next)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Processing -> Finished.` });
      setOverlayOn(false);
      setOverlayJob(null);
      return;
    }

    // If progress returns something odd, trust the actual job status from DB
    const job = overlayFromProgress ?? (await fetchFullRow(tag));
    const liveStatus = String(job?.['Status'] ?? job?.status ?? '').trim();

    if (isProcessingLike(liveStatus)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Processing.` });
      setOverlayOn(true);
      setOverlayJob(job);
      return;
    }

    if (isFinishedLike(liveStatus)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Finished/Ready.` });
      setOverlayOn(false);
      setOverlayJob(null);
      return;
    }

    const liveCapeStatus = String(job?.['Cape Status'] ?? job?.capingStatus ?? job?.caping_status ?? '').trim();
    if (progressedField === 'caping_status' && isFinishedLike(liveCapeStatus)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Cape finished.` });
      setOverlayOn(false);
      setOverlayJob(null);
      return;
    }

    setStatus({ kind: 'err', text: `Tag ${tag}: unexpected transition (${next || 'unknown'}).` });
  }

  const handleManualSubmit = async () => {
    const tag = manualTag.trim();
    if (!tag) return;
    setManualBusy(true);
    try {
      await handleScan(tag);
      setManualTag('');
    } finally {
      setManualBusy(false);
    }
  };

  useScanner((code) => {
    void handleScan(code);
  }, { resetMs: 150 });

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
      <div
        style={{
          display: 'grid',
          gap: 14,
          marginBottom: 16,
          padding: 18,
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(18,34,23,.98) 0%, rgba(34,65,45,.98) 100%)',
          border: '1px solid rgba(200,138,61,.18)',
          color: '#f8fafc',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#b9ddc2' }}>Scan Workflow</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 48, lineHeight: 1.1 }}>Processing Scanner</h1>
          <p style={{ margin: '10px 0 0', maxWidth: 680, color: 'rgba(248,250,252,.86)', lineHeight: 1.6 }}>
            Use this screen during production to advance deer through cape and meat processing in the correct order. The page listens for barcode scans automatically.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 8,
            padding: 14,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,.14)',
            background: 'rgba(255,255,255,.08)',
          }}
        >
          <div style={{ fontWeight: 900 }}>How scans progress</div>
          {nextScanGuide.map((item) => (
            <div key={item} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start', color: 'rgba(248,250,252,.92)', lineHeight: 1.5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#c88a3d', marginTop: 6 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* visible status panel */}
      <div
        style={{
          marginTop: 8,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid rgba(148,163,184,.35)',
          background: 'rgba(15,23,42,.65)',
          color: '#e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ fontSize: 16, opacity: 0.9 }}>Ready to scan</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{lastTag ? `Last scanned: ${lastTag}` : 'Awaiting tag...'}</div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 14,
          padding: 14,
          display: 'grid',
          gap: 10,
          background: 'rgba(15,23,42,.45)',
          border: '1px solid rgba(148,163,184,.28)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, opacity: 0.86, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Manual Tag Entry
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          If the scanner is not working or you want to retry a tag by hand, enter it here and submit one scan.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={manualTag}
            onChange={(e) => setManualTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleManualSubmit();
              }
            }}
            placeholder="Enter deer tag"
            aria-label="Enter deer tag"
            style={{ flex: '1 1 280px', minWidth: 240 }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => void handleManualSubmit()}
            disabled={manualBusy || !manualTag.trim()}
          >
            {manualBusy ? 'Submitting...' : 'Submit Tag'}
          </button>
        </div>
      </div>

      {status && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid',
            borderColor: status.kind === 'ok' ? '#10b981' : '#ef4444',
            background: status.kind === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            color: status.kind === 'ok' ? '#d1fae5' : '#fee2e2',
          }}
        >
          {status.text}
        </div>
      )}

      <ButcherOverlay
        job={overlayJob ?? undefined}
        visible={overlayOn}
        manualTag={manualTag}
        manualBusy={manualBusy}
        webbsEnabled={webbsEnabled}
        cutOptions={cutOptions}
        onManualTagChange={setManualTag}
        onManualSubmit={() => void handleManualSubmit()}
      />
    </main>
  );
}


