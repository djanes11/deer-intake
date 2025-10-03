// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  typedRoutes: false,
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: [
      '@sparticuz/chromium-min',
      'puppeteer-core',
    ],
  },
  // force-pack chromium-min brotli files into the API bundle
  outputFileTracingIncludes: {
    'app/api/gas2/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
    // optional: cover other API routes too
    'app/api/**/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
  },
};

export default config;

