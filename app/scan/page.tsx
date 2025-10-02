'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScanner } from '@/lib/useScanner';
import { progress } from '@/lib/api';

function useBeep() {
  // Tiny WebAudio beeps: success & error
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => (ctxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)());
  const play = (freq = 880, durMs = 120, type: OscillatorType = 'sine', gain = 0.04) => {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    osc.start(t);
    osc.stop(t + durMs / 1000);
  };
  return {
    ok: () => { play(1046, 90, 'triangle', 0.05); setTimeout(()=>play(1318, 110, 'triangle', 0.05), 60); },
    err: () => { play(220, 140, 'sawtooth', 0.06); setTimeout(()=>play(196, 160, 'sawtooth', 0.06), 70); }
  };
}

export default function ScanKiosk() {
  const router = useRouter();
  const [last, setLast] = useState<string>('');
  const [status, setStatus] = useState<{ kind:'idle'|'ok'|'err'; text:string }>({ kind:'idle', text:'' });

  const guardRef = useRef({ lastAt: 0, lastTag: '' });
  const beeps = useBeep();

  useScanner(async (rawTag) => {
    const tag = String(rawTag || '').trim();
    const now = Date.now();
    // Debounce: ignore events within 250ms; also ignore immediate duplicate within 1000ms
    if (now - guardRef.current.lastAt < 250) return;
    if (tag === guardRef.current.lastTag && now - guardRef.current.lastAt < 1000) return;
    guardRef.current = { lastAt: now, lastTag: tag };

    setLast(tag);
    setStatus({ kind:'idle', text:'' });

    try {
      const res = await progress(tag);
      if (!res?.ok) throw new Error(res?.error || 'Could not progress');

      if (res.nextStatus === 'Processing') {
        setStatus({ kind:'ok', text:'Processing — opening butcher view…' });
        beeps.ok();
        router.push(`/butcher/intake?tag=${encodeURIComponent(tag)}`);
      } else if (res.nextStatus === 'Finished') {
        setStatus({ kind:'ok', text:'Marked Finished ✓' });
        beeps.ok();
        // Keep kiosk ready for the next scan
        setTimeout(() => setStatus({ kind:'idle', text:'' }), 1000);
      } else {
        setStatus({ kind:'err', text:'No status change' });
        beeps.err();
        setTimeout(() => setStatus({ kind:'idle', text:'' }), 1000);
      }
    } catch (e: any) {
      setStatus({ kind:'err', text: e?.message || 'Scan failed' });
      beeps.err();
    }
  });

  return (
    <main className="scan-page" style={{ textAlign:'center' }}>
      <h1 style={{ margin:'4px 0 8px' }}>Scan a Tag</h1>
      <p style={{ color:'var(--muted)', margin:'0 0 16px' }}>
        Scan once to start Processing; scan again to mark Finished.
      </p>

      <div style={{ fontSize:56, fontWeight:900, letterSpacing:1, margin:'14px 0' }}>{last || '—'}</div>

      {/* Big, color banner */}
      <div
        aria-live="polite"
        style={{
          minHeight: 52,
          display:'grid',
          placeItems:'center',
          fontWeight:800,
          border:'1px solid var(--border)',
          borderRadius:12,
          margin:'10px auto 0',
          maxWidth: 680,
          padding:'10px 12px',
          background:
            status.kind === 'ok' ? '#ecfdf5' :
            status.kind === 'err' ? '#fef2f2' : 'rgba(255,255,255,0.9)',
          color:
            status.kind === 'ok' ? '#065f46' :
            status.kind === 'err' ? '#991b1b' : 'var(--muted)'
        }}
      >
        {status.text || 'Ready for next scan'}
      </div>
    </main>
  );
}
