// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Do NOT static export (you have API routes)
  // output: undefined,

  // Use default build dir that Vercel expects
  // distDir: '.next',

  // Kill typedRoutes completely
  typedRoutes: false,
};

export default config;
