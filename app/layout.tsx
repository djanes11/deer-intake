// app/layout.tsx
import './globals.css';
import Nav from './components/Nav';
import NavGate from './components/NavGate';

// Public-only chrome (no staff logic touched)
import CustomerHeader from './components/CustomerHeader';
import AlertBanner from './components/AlertBanner';

export const dynamic = 'force-dynamic'; // read env per request

export const metadata = {
  title: 'McAfee Deer Processing — Palmyra, IN',
  description:
    'Fast, clean, professional deer processing. Overnight drop, specialty products, and online status tracking.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  openGraph: {
    title: 'McAfee Deer Processing',
    description:
      'Overnight drop, specialty products, and online status tracking. Palmyra, IN.',
    url: 'https://deer-intake-public.vercel.app',
    siteName: 'McAfee Deer Processing',
    type: 'website',
  },
};

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Public banner values via env so you can toggle without code changes
  const bannerText  = process.env.PUBLIC_BANNER_TEXT || null; // e.g. "🎄 Holiday hours in effect"
  const bannerTone  = (process.env.PUBLIC_BANNER_TONE as any) || 'warning'; // info|warning|danger|success
  const bannerLinkT = process.env.PUBLIC_BANNER_LINK_TEXT || null; // e.g. "See hours"
  const bannerLinkH = process.env.PUBLIC_BANNER_LINK_URL  || null; // e.g. "/hours"
  const bannerDismiss = process.env.PUBLIC_BANNER_DISMISS !== '0'; // set to 0 to make non-dismissible

  return (
    <html lang="en">
      <head>
        {/* Mobile viewport for sane scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Respect users’ prefers-reduced-motion setting */}
        <meta name="color-scheme" content="dark light" />
      </head>
	<body className={`${IS_PUBLIC ? 'public' : ''} watermark`}>
        {/* Staff navigation (hidden on public) */}
        {!IS_PUBLIC ? (
          <NavGate>
            <Nav />
          </NavGate>
        ) : null}

        {/* Public header + announcement (only in PUBLIC_MODE) */}
        {IS_PUBLIC ? (
          <>
            <CustomerHeader />
            <AlertBanner
              id="public-top-banner"
              text={bannerText}
              tone={bannerTone}
              linkText={bannerLinkT}
              linkHref={bannerLinkH}
              dismissible={bannerDismiss}
            />
          </>
        ) : null}

        <main>{children}</main>
      </body>
    </html>
  );
}
