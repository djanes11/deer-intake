// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // keep your current flags
  typedRoutes: false,
  experimental: {
    typedRoutes: false,
    // Let Next bundle native deps used only on the server
    serverComponentsExternalPackages: [
      '@sparticuz/chromium-min',
      'puppeteer-core',
    ],
  },

  // Force-pack chromium-min's brotli bin files into the gas2 lambda
  outputFileTracingIncludes: {
    'app/api/gas2/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
    // if you later generate PDFs from other routes, add them here too
    // 'app/api/another/route.ts': ['node_modules/@sparticuz/chromium-min/bin/**'],
  },
};

export default config;
