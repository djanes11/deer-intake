// app/layout.tsx
import './globals.css';
import Nav from './components/Nav';
import NavGate from './components/NavGate';

export const dynamic = 'force-dynamic'; // ensure env is read per request

export const metadata = {
  title: 'McAfee Deer Processing',
  description: 'Custom deer processing',
};

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Mobile viewport for sane scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="watermark">
        {/* Hide staff navigation when running the public deployment */}
        {!IS_PUBLIC ? (
          <NavGate>
            <Nav />
          </NavGate>
        ) : null}
        <main>{children}</main>
      </body>
    </html>
  );
}
