// app/page.tsx
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="home">
      {/* Hero */}
      <section className="hero card-ghost" aria-labelledby="home-title">
        <div className="hero-kicker">Welcome</div>
        <h1 className="hero-title" id="home-title">McAfee Deer Processing</h1>
        <p className="hero-sub">
          Pick what you want to do. Quick access to the most common actions.
        </p>
      </section>

      {/* Action tiles */}
      <section className="tile-grid" aria-label="Quick actions">
        <Link href="/intake" className="tile">
          <div className="tile-emoji" aria-hidden>📝</div>
          <div className="tile-title">New Intake form</div>
          <div className="tile-sub">Start a new Intake Form</div>
        </Link>

        <Link href="/scan" className="tile">
          <div className="tile-emoji" aria-hidden>📷</div>
          <div className="tile-title">Scan Tags</div>
          <div className="tile-sub">Update status by scanning a barcode</div>
        </Link>

        <Link href="/search" className="tile">
          <div className="tile-emoji" aria-hidden>🔎</div>
          <div className="tile-title">Search</div>
          <div className="tile-sub">Find jobs by name, tag, or confirmation #</div>
        </Link>


        <Link href="/reports/calls" className="tile tile-alt">
          <div className="tile-emoji" aria-hidden>☎️</div>
          <div className="tile-title">Call Report</div>
          <div className="tile-sub">Who to call & why</div>
        </Link>
      </section>
    </div>
  );
}
