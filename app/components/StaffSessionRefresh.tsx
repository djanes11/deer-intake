'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { subscribeStaffSessionRefresh } from '@/lib/staffSessionRefresh';

export default function StaffSessionRefresh() {
  const path = usePathname();
  const managesOwnSession = path === '/staff/login' || path === '/staff/logout' || path === '/staff/reset-password';
  useEffect(() => {
    if (managesOwnSession) return;
    try {
      return subscribeStaffSessionRefresh(getSupabaseBrowser().auth).stop;
    } catch { /* Local-username installations need no Supabase browser session. */ }
  }, [managesOwnSession]);
  return null;
}
