'use client';

import { useRef, useState } from 'react';
import { useScanner } from '@/lib/useScanner';
import { progress } from '@/lib/api';

function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => (ctxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)());
  const play = (freq = 880, durMs = 120, type: OscillatorType = 'sine', gain = 0.05) => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      g.disconnect();
    }, durMs);
  };
  return { ok: () => play(880, 120, 'sine', 0.06), err: () => play(240, 200, 'square', 0.07) };
}

type Status =
  | { kind: 'idle'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'err'; text: string };

export default function ScanPage() {
  const [last, setLast] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: 'Ready for next scan' });
  const { ok, err } = useBeep();

  useScanner(async (raw) => {
    const tag = String(raw).trim().replace(/[^0-9A-Za-z-]/g, '');
    if (!tag) return;

    setLast(tag);
    setStatus({ kind: 'idle', text: '' });

    try {
      // IMPORTANT: send object, not raw string
      const res = await progress({ tag });
      if (!res?.ok) throw new Error(res?.error || 'Could not progress');

      // We do NOT navigate. We only report what happened.
      if (res.nextStatus === 'Processing') {
        setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Processing.` });
        ok();
      } else if (res.nextStatus === 'Finished') {
        setStatus({ kind: 'ok', text: `Tag ${tag}: moved to Finished/Ready.` });
        ok();
      } else {
        setStatus({ kind: 'err', text: `Tag ${tag}: no status change.` });
        err();
      }
    } catch (e: any) {
      setStatus({ kind: 'err', text: e?.message || 'Failed to progress' });
      err();
    }
  }, { resetMs: 150 });

  return (
    <main style={{ maxWidth: 640, margin: '40px auto' }}>
      <h1>Scan</h1>
      <div style={{ margin:'8px 0', color:'#94a3b8' }}>
        First scan: Dropped → Processing. Second scan: Processing → Finished.
      </div>

      <div style={{
        marginTop: 10, padding:'10px 12px', border:'1px dashed #94a3b8', borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
      }}>
        Last scan: {last || '—'}
      </div>

      <div
        role="status"
        style={{
          marginTop: 12,
          padding:'10px 12px',
          background:
            status.kind === 'ok' ? '#ecfdf5' :
            status.kind === 'err' ? '#fef2f2' : 'rgba(255,255,255,0.9)',
          color:
            status.kind === 'ok' ? '#065f46' :
            status.kind === 'err' ? '#991b1b' : '#64748b'
        }}
      >
        {status.text}
      </div>
    </main>
  );
}
