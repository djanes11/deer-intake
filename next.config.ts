// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // keep your setting
  typedRoutes: false,
  experimental: {
    typedRoutes: false,
  },
  // no outputFileTracingIncludes, no externalPackages
};

export default config;


