// app/components/NavGate.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function NavGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const isScanPage = pathname?.startsWith('/scan');
  const hideChrome =
    pathname?.startsWith('/intake/') ||
    pathname?.startsWith('/butcher') ||
    (isScanPage && isFullscreen) ||
    pathname?.startsWith('/staff/login') ||
    pathname?.startsWith('/staff/logout');
  if (hideChrome) return null;
  return <>{children}</>;
}
