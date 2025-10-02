// app/layout.tsx
import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'McAfee Deer Processing',
  description: 'Custom deer processing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Mobile viewport for sane scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      {/* Add the watermark class here */}
      <body className="watermark">
        <header className="site-header">
          <div className="wrap">
            <div className="brand">
              <img src="/mcafee-logo.png" alt="McAfee Custom Deer Processing" />
              <Link href="/">McAfee Deer Processing</Link>
            </div>

            {/* Mobile toggle (CSS-only) */}
            <label htmlFor="nav-check" className="menu-toggle" aria-label="Toggle menu">☰ Menu</label>
            <input id="nav-check" type="checkbox" aria-hidden="true" />

            <nav className="menu" aria-label="Primary">
              <Link href="/" className="item">Home</Link>
              <Link href="/intake" className="item">Intake form</Link>
              <Link href="/scan" className="item">Scan Tags</Link>
              <Link href="/search" className="item">Search</Link>
              <Link href="/board" className="item">Board</Link>

              {/* Dropdown */}
              <div className="dropdown">
                <span tabIndex={0} className="item">Reports</span>
                <div className="dropdown-menu">
                  <Link href="/reports/calls">Call Report</Link>
                </div>
              </div>
            </nav>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}

