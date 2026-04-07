// app/layout.tsx
import './globals.css';
import Nav from './components/Nav';
import NavGate from './components/NavGate';
import CustomerHeader from './components/CustomerHeader';
import AlertBanner from './components/AlertBanner';
import { getPublicSiteSettings } from '@/lib/siteSettings';
import { headers } from 'next/headers';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const h = await headers().catch(() => null);
  const host = h ? (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0]?.trim() || '' : '';
  const settings = process.env.PUBLIC_MODE === '1' ? await getPublicSiteSettings().catch(() => null) : null;
  const name = settings?.branding?.name || SITE.name;
  const location = settings?.branding?.locationLabel ? ` - ${settings.branding.locationLabel}` : '';
  const description =
    settings?.branding?.tagline ||
    'Fast, clean, professional deer processing. Public intake, specialty products, and online status tracking.';
  const siteUrl = host ? `https://${host}` : undefined;

  return {
    title: `${name}${location}`,
    description,
    icons: [{ rel: 'icon', url: '/favicon.ico' }],
    openGraph: {
      title: name,
      description,
      url: siteUrl,
      siteName: name,
      type: 'website',
    },
  };
}

const IS_PUBLIC = process.env.PUBLIC_MODE === '1';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = IS_PUBLIC ? await getPublicSiteSettings() : null;
  const bannerText = settings?.banner_enabled
    ? settings.banner_message
    : process.env.PUBLIC_BANNER_TEXT || null;
  const bannerTone = (process.env.PUBLIC_BANNER_TONE as any) || 'warning';
  const bannerLinkT = process.env.PUBLIC_BANNER_LINK_TEXT || null;
  const bannerLinkH = process.env.PUBLIC_BANNER_LINK_URL || null;
  const bannerDismiss = process.env.PUBLIC_BANNER_DISMISS !== '0';

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={`${IS_PUBLIC ? 'public' : ''} watermark`}>
        {!IS_PUBLIC ? (
          <NavGate>
            <Nav />
          </NavGate>
        ) : null}

        {IS_PUBLIC ? (
          <>
            <CustomerHeader branding={settings?.branding} />
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
