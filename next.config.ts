// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // DO NOT static-export; you have API routes.
  // If you had `output: 'export'` — remove it.
  // @ts-ignore - make sure it's unset
  output: undefined,

  // Make sure Next writes to the default dir Vercel expects:
  distDir: '.next',

  // optional sanity
  experimental: {
    typedRoutes: false,
  },
};

export default config;