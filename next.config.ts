// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  typedRoutes: false,   // ← this must be present and false
  // Leave output/distDir alone (default .next)
};

export default config;

