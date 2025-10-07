// app/scan/page.tsx — scan-only with aggressive flatten + canonization (overlay kept dumb)
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ButcherOverlay from '@/app/components/ButcherOverlay';
import { useScanner } from '@/lib/useScanner';
import { progress, searchJobs } from '@/lib/api';

type AnyRec = Record<string, any>;

export default function ScanPage() {
  const hiddenRef = useRef<HTMLInputElement>(null);

  const [lastTag, setLastTag] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayJob, setOverlayJob] = useState<AnyRec | null>(null);

  useEffect(() => {
    const focus = () => hiddenRef.current?.focus();
    focus();
    window.addEventListener('focus', focus);
    const id = setInterval(focus, 2000);
    return () => { window.removeEventListener('focus', focus); clearInterval(id); };
  }, []);

  const isProcessingLike = (s: any) => String(s ?? '').toLowerCase().includes('processing');
  const isFinishedLike = (s: any) => {
    const v = String(s ?? '').toLowerCase();
    return v.includes('finished') || v.includes('ready');
  };

  // ===== Canon headers from your sheet =====
  const HEADERS = [
    "Tag","Confirmation #","Customer","Phone","Email","Address","City","State","Zip",
    "County Killed","Sex","Process Type","Drop-off Date","Status","Caping Status","Webbs Status",
    "Steak","Steak Size (Other)","Burger Size","Steaks per Package","Beef Fat",
    "Hind Roast Count","Front Roast Count","Backstrap Prep","Backstrap Thickness","Backstrap Thickness (Other)",
    "Notes","Webbs Order","Webbs Order Form Number","Webbs Pounds","Price","Paid",
    "Specialty Products","Specialty Pounds","Summer Sausage (lb)","Summer Sausage + Cheese (lb)","Sliced Jerky (lb)",
    "Hind - Steak","Hind - Roast","Hind - Grind","Hind - None","Front - Steak","Front - Roast","Front - Grind","Front - None",
    "Notified Ready At","Public Token","Public Link Sent At","Drop-off Email Sent At",
    "Processing Price","Specialty Price",
    "Paid Processing","Paid Processing At","Paid Specialty","Paid Specialty At",
    "Picked Up - Processing","Picked Up - Processing At","Picked Up - Cape","Picked Up - Cape At","Picked Up - Webbs","Picked Up - Webbs At",
    "Call Attempts","Last Called At","Last Called By","Last Call Outcome","Last Call At","Call Notes",
    "Meat Attempts","Cape Attempts","Webbs Attempts","Requires Tag","Phone Last4"
  ];

  // === Key helpers: flatten anything → array of objects keyed by headers ===
  const toKey = (s: string) => s?.toString()?.normalize('NFKC').toLowerCase().replace(/[^a-z]/g, '') || '';
  const headerKeyIndex: Record<string,string> = (() => {
    const m: Record<string,string> = {};
    for (const h of HEADERS) m[toKey(h)] = h;
    // common aliases
    Object.assign(m, {
      customer: 'Customer', customername: 'Customer', name: 'Customer', cust: 'Customer',
      steaksize: 'Steak',
      steaksperpkg: 'Steaks per Package', steaksperpackage: 'Steaks per Package',
      burgersize: 'Burger Size',
      backstrapprep: 'Backstrap Prep',
      backstrapthickness: 'Backstrap Thickness',
      backstrapthicknessother: 'Backstrap Thickness (Other)',
      steaksizeother: 'Steak Size (Other)',
      specialtypounds: 'Specialty Pounds',
      webbsorder: 'Webbs Order',
      webbsorderformnumber: 'Webbs Order Form Number',
      webbspounds: 'Webbs Pounds',
      hindsteak: 'Hind - Steak', hindroast: 'Hind - Roast', hindgrind: 'Hind - Grind', hindnone: 'Hind - None',
      frontsteak: 'Front - Steak', frontroast: 'Front - Roast', frontgrind: 'Front - Grind', frontnone: 'Front - None',
    });
    return m;
  })();

  function fromArrays(headers: string[], rows: any[]): AnyRec[] {
    return rows.map((arr: any[]) =>
      Object.fromEntries(headers.map((h, i) => [h, arr?.[i] ?? '']))
    );
  }

  function dictToCanon(d: AnyRec): AnyRec {
    const out: AnyRec = {};
    for (const [k, v] of Object.entries(d || {})) {
      const canon = headerKeyIndex[toKey(k)];
      if (canon) out[canon] = v;
    }
    // “Customer” guarantee from common variants
    if (!('Customer' in out)) {
      out['Customer'] =
        d['Customer'] ?? d['Customer Name'] ?? d['CustomerName'] ?? d['customerName'] ??
        d['customer_name'] ?? d['name'] ?? d['customer'] ?? '';
    }
    return out;
  }

  function flattenPayload(payload: any): AnyRec[] {
    if (!payload) return [];
    // direct objects
    if (Array.isArray(payload) && payload.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
      return (payload as AnyRec[]).map(dictToCanon);
    }
    // { rows, headers? } or { items } shapes
    if (payload.rows) {
      const rows = payload.rows;
      const headers: string[] = (payload.headers?.length ? payload.headers : HEADERS) as string[];
      if (Array.isArray(rows) && rows.length) {
        if (Array.isArray(rows[0])) return fromArrays(headers, rows).map(dictToCanon);
        if (typeof rows[0] === 'object') return rows.map(dictToCanon);
      }
    }
    if (payload.items && Array.isArray(payload.items)) {
      const items = payload.items;
      if (items.length && Array.isArray(items[0])) return fromArrays(HEADERS, items).map(dictToCanon);
      return items.map(dictToCanon);
    }
    // { header,row } / { headers, values } / { values }
    if (payload.header && payload.row) {
      return fromArrays(payload.header, [payload.row]).map(dictToCanon);
    }
    if (payload.headers && payload.values) {
      const values = Array.isArray(payload.values[0]) ? payload.values : [payload.values];
      return fromArrays(payload.headers.length ? payload.headers : HEADERS, values).map(dictToCanon);
    }
    if (payload.values && Array.isArray(payload.values)) {
      return fromArrays(HEADERS, payload.values).map(dictToCanon);
    }
    if (payload.data?.values && Array.isArray(payload.data.values)) {
      return fromArrays(HEADERS, payload.data.values).map(dictToCanon);
    }
    // Google Sheets feed style gsx$customer, etc.
    if (payload.entry && Array.isArray(payload.entry)) {
      const rows: AnyRec[] = payload.entry.map((e: any) => {
        const d: AnyRec = {};
        Object.keys(e).forEach(k => {
          if (k.startsWith('gsx$')) {
            const label = k.slice(4); // after gsx$
            d[label] = e[k]?.$t ?? '';
          }
        });
        return dictToCanon(d);
      });
      return rows;
    }
    // array-of-arrays
    if (Array.isArray(payload) && payload.length && Array.isArray(payload[0])) {
      return fromArrays(HEADERS, payload).map(dictToCanon);
    }
    // single dict fallback
    if (typeof payload === 'object') return [dictToCanon(payload)];
    return [];
  }

  const truthy = (v: any) => {
    if (typeof v === 'boolean') return v;
    const s = String(v ?? '').trim().toLowerCase();
    if (!s || ['0','false','no','off','none','n/a','na'].includes(s)) return false;
    if (['true','yes','y','x','1','✓','✔','on'].includes(s)) return true;
    const n = Number(s); return Number.isFinite(n) ? n > 0 : !!s;
  };
  function normalizeToggles(o: AnyRec) {
    const keys = ['Hind - Steak','Hind - Roast','Hind - Grind','Hind - None','Front - Steak','Front - Roast','Front - Grind','Front - None'];
    for (const k of keys) if (k in o) o[k] = truthy(o[k]);
    return o;
  }

  async function fetchFullRow(tag: string): Promise<AnyRec> {
    const t = String(tag).trim();

    // 1) action=job (if your route supports it)
    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'job', tag: t }),
        cache: 'no-store',
      });
      if (r.ok) {
        const j = await r.json();
        const rows = flattenPayload(j?.job ?? j);
        const row = rows.find(r => String(r?.Tag ?? r?.tag).trim() === t) || rows[0] || null;
        if (row) return normalizeToggles({ Tag: t, ...row });
      }
    } catch {}

    // 2) action=get (your older full-row shape)
    try {
      const r = await fetch('/api/gas2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', tag: t }),
        cache: 'no-store',
      });
      if (r.ok) {
        const j = await r.json();
        const rows = flattenPayload(j?.job ?? j);
        const row = rows.find(r => String(r?.Tag ?? r?.tag).trim() === t) || rows[0] || null;
        if (row) return normalizeToggles({ Tag: t, ...row });
      }
    } catch {}

    // 3) last resort: action=search (summary)
    try {
      const res: any = await searchJobs(t);
      const rows = flattenPayload(res);
      const row = rows.find(r => String(r?.Tag ?? r?.tag).trim() === t) || rows[0] || null;
      if (row) return normalizeToggles({ Tag: t, ...row });
    } catch {}

    return { Tag: t };
  }

  async function handleScan(code: string) {
    const tag = String(code || '').trim();
    if (!tag) return;
    setLastTag(tag);

    let next = '';
    try {
      const res: any = await progress(tag);
      next = String(res?.nextStatus || '').trim();
    } catch {
      setStatus({ kind: 'err', text: `Tag ${tag}: progress failed.` });
      return;
    }

    if (isProcessingLike(next)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Dropped Off → Processing.` });
      setOverlayOn(true);
      const job = await fetchFullRow(tag);
      setOverlayJob(job);
      try { new BroadcastChannel('butcher').postMessage({ type: 'SHOW', job }); } catch {}
    } else if (isFinishedLike(next)) {
      setStatus({ kind: 'ok', text: `Tag ${tag}: Processing → Finished/Ready.` });
      setOverlayOn(false);
      setOverlayJob(null);
    } else {
      const job = await fetchFullRow(tag);
      const sheetStatus = String(job?.['Status'] ?? job?.status ?? '').trim();
      if (isProcessingLike(sheetStatus)) {
        setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Processing.` });
        setOverlayOn(true);
        setOverlayJob(job);
      } else if (isFinishedLike(sheetStatus)) {
        setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Finished/Ready.` });
        setOverlayOn(false);
        setOverlayJob(null);
      } else {
        setStatus({ kind: 'err', text: `Tag ${tag}: unexpected transition (${next || 'unknown'}).` });
      }
    }
  }

  useScanner((code) => { void handleScan(code); }, { resetMs: 150 });

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 48, lineHeight: 1.1 }}>Scan</h1>

      {/* hidden input keeps focus for wedge scanners; no manual typing */}
      <input
        ref={hiddenRef}
        type="text"
        inputMode="none"
        aria-hidden="true"
        readOnly
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

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
        <div style={{ fontSize: 16, opacity: .9 }}>Ready to scan</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{lastTag ? `Last: ${lastTag}` : 'Awaiting tag…'}</div>
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

      <ButcherOverlay job={overlayJob ?? undefined} visible={overlayOn} />
    </main>
  );
}

