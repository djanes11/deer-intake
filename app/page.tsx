// app/page.tsx
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page-wrap">
      <h1 style={{margin: '4px 0 12px'}}>Welcome</h1>
      <p style={{color:'#6b7280', margin:'0 0 16px'}}>Pick what you want to do.</p>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
        gap:12
      }}>
        {/* New Intake form (replaces New / Edit Intake) */}
        <Link href="/intake" className="home-card">
          <div className="home-card-ico">📝</div>
          <div className="home-card-title">New Intake form</div>
          <div className="home-card-sub">Start a new Intake Form</div>
        </Link>

        {/* Scan Tags (replaces Scan / Load Tag) */}
        <Link href="/scan" className="home-card">
          <div className="home-card-ico">📷</div>
          <div className="home-card-title">Scan Tags</div>
          <div className="home-card-sub">Scan a barcode to update the Status of the Order</div>
        </Link>

        {/* Leave Search alone */}
        <Link href="/search" className="home-card">
          <div className="home-card-ico">🔎</div>
          <div className="home-card-title">Search</div>
          <div className="home-card-sub">Find jobs by name, tag, or confirmation #</div>
        </Link>
      </div>

      <style jsx>{`
        .home-card {
          display:block;
          border:1px solid var(--border);
          border-radius:12px;
          background:#fff;
          padding:14px;
          transition: transform .08s ease, box-shadow .08s ease, border-color .08s ease;
          box-shadow: 0 8px 20px rgba(15, 23, 42, .04);
        }
        .home-card:hover {
          transform: translateY(-1px);
          border-color:#cbd5e1;
          box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
        }
        .home-card-ico { font-size:22px; line-height:1; margin-bottom:8px; }
        .home-card-title { font-weight:800; margin-bottom:4px; color:var(--ink); }
        .home-card-sub { font-size:13px; color:var(--muted); }
      `}</style>
    </main>
  );
}
