// app/help/overnight-qr/page.tsx — Standalone Overnight Drop QR page
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Image from 'next/image';

export default function OvernightQRPage() {
  return (
    <main className="light-page" style={{margin:'0 auto', maxWidth:960, padding:'18px 14px 40px'}}>
      <section className="form-card" style={{padding:14, borderRadius:12}}>
        <h1 style={{margin:'0 0 8px'}}>Overnight Drop — Scan Here</h1>
        <p className="muted" style={{marginTop:0}}>Post this at the night drop. It opens the Overnight Drop flow.</p>
        <div style={{display:'flex', justifyContent:'center', marginTop:10}}>
          <div style={{background:'#fff', border:'1px solid #e6e9ec', borderRadius:12, padding:12}}>
            <Image
              src="/img/overnight-qr.png"
              alt="Overnight Drop QR"
              width={320}
              height={320}
              priority
              style={{ display:'block', height:'auto', width:'320px' }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}