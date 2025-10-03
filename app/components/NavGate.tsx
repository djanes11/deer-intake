// app/components/NavGate.tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function NavGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith('/intake/');
  if (hideChrome) return null;       // hide Nav (and any other chrome you wrap) on intake routes
  return <>{children}</>;
}
