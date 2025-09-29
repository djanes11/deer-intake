'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ButcherScreen() {
  const router = useRouter();
  const buf = useRef('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastTag, setLastTag] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      setError('');
      // Scanner types fast characters then an Enter.
      if (e.key === 'Enter') {
        const tag = buf.current.trim();
        buf.current = '';
        if (tag) {
          setLastTag(tag);
          router.push(`/intake?tag=${encodeURIComponent(tag)}`);
        }
        return;
      }
      if (e.key.length === 1) {
        buf.current += e.key;
        if (t.current) clearTimeout(t.current);
        // If human typing (slow), we reset the buffer—keeps this page scanner-only.
        t.current = setTimeout(() => (buf.current = ''), 120);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // Optional: Fullscreen + Wake Lock to keep TV alive
  useEffect(() => {
    let lock: any;
    const go = async () => {
      try {
        if (document.fullscreenElement == null) {
          await document.documentElement.requestFullscreen();
        }
        // @ts-ignore
        if (navigator.wakeLock?.request) {
          // @ts-ignore
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {}
    };
    go();
    return () => { try { lock?.release?.(); } catch {} };
  }, []);

  return (
    <main className="page-wrap" style={{textAlign:'center'}}>
      <div className="cardlike" style={{padding:24}}>
        <h1 style={{margin:'0 0 4px'}}>Scan a Tag</h1>
        <div style={{color:'var(--muted)', marginBottom:12}}>
          Point the scanner at the barcode/QR. This screen will switch automatically.
        </div>
        <div style={{fontSize:48, fontWeight:800, letterSpacing:1, margin:'12px 0 6px'}}>
          {lastTag || '—'}
        </div>
        {error && <div style={{color:'#b91c1c', fontWeight:700}}>{error}</div>}
        <div style={{marginTop:12, display:'flex', gap:8, justifyContent:'center'}}>
          <button className="btn" onClick={() => document.documentElement.requestFullscreen().catch(()=>{})}>Go Full Screen</button>
          <button className="btn" onClick={() => location.reload()}>Reset</button>
        </div>
      </div>
      <style jsx>{`
        .cardlike {
          background:#fff; border:1px solid var(--border);
          border-radius:12px; box-shadow: 0 8px 20px rgba(15, 23, 42, .05);
        }
        .btn {
          padding:8px 12px; border:1px solid var(--border); border-radius:8px;
          background:#155acb; color:#fff; font-weight:800; cursor:pointer;
        }
      `}</style>
    </main>
  );
}
