// app/components/NavGate.tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function NavGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname?.startsWith('/intake/') ||
    pathname?.startsWith('/butcher') ||
    pathname?.startsWith('/scan') ||
    pathname?.startsWith('/staff/login') ||
    pathname?.startsWith('/staff/logout');
  if (hideChrome) return null;
  return <>{children}</>;
}
