'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { clearStaffAccessCookie } from '@/lib/staffSession';

export default function StaffLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const supabase = getSupabaseBrowser();
        await supabase.auth.signOut();
      } catch {
        // Ignore client sign-out errors and still clear cookie.
      }
      clearStaffAccessCookie();
      if (!cancelled) {
        router.replace('/staff/login');
        router.refresh();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main style={{ maxWidth: 460, margin: '48px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: 20 }}>
        Signing out...
      </div>
    </main>
  );
}
