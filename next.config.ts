// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Don’t static-export; you have API routes
  // output: 'export', // ❌ remove if present

  // Use default .next output dir (Vercel expects this)
  // distDir: '.next', // optional; default is fine

  // IMPORTANT: turn OFF typedRoutes
  typedRoutes: false,
};

export default config;
