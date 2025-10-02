// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // leave output/distDir alone (defaults are good for Vercel)
  typedRoutes: false,            // <- hard off
  experimental: { typedRoutes: false }, // <- belt & suspenders, neutralizes old settings
};

export default config;
