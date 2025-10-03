// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // keep your existing flags
  typedRoutes: false,
  experimental: {
    typedRoutes: false,
    serverComponentsExternalPackages: [
      '@sparticuz/chromium-min',
      'puppeteer-core',
    ],
  },

  // CRITICAL: force-pack chromium-min's brotli files into your API lambdas
  outputFileTracingIncludes: {
    // target the app-route file that renders PDFs
    'app/api/gas2/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
    // optional belt-and-suspenders for other app routes
    'app/api/**/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
    'app/api/**/route.js': ['node_modules/@sparticuz/chromium-min/bin/**'],
  },
};

export default config;

