'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { subscribeStaffSessionRefresh } from '@/lib/staffSessionRefresh';
import { isProtectedStaffPath, staffLoginUrl } from '@/lib/staffRouteAccess';

export default function StaffSessionRefresh({ children, publicMode = false }: { children: ReactNode; publicMode?: boolean }) {
  const path = usePathname() || '/';
  const protectedPage = isProtectedStaffPath(path, publicMode);
  const managesOwnSession = ['/staff/login', '/staff/logout', '/staff/reset-password', '/staff/forgot-password'].includes(path);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    if (managesOwnSession) return;
    let disposed = false;
    let checking: Promise<void> | null = null;
    let signingOut = false;
    let auth: ReturnType<typeof getSupabaseBrowser>['auth'] | undefined;
    const originalFetch = window.fetch;
    const send: typeof fetch = (...args) => originalFetch.call(window, ...args);
    let refresh: ReturnType<typeof subscribeStaffSessionRefresh> | undefined;
    try {
      auth = getSupabaseBrowser().auth;
      refresh = subscribeStaffSessionRefresh(auth, send);
    } catch { /* Local username logins use only the server session. */ }

    const hide = () => { if (!disposed && protectedPage) setLocked(true); };
    const redirect = () => {
      if (disposed || !protectedPage) return;
      hide();
      window.location.replace(staffLoginUrl(window.location.pathname, window.location.search));
    };
    const requestSession = () => send('/api/staff/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const verify = () => {
      if (disposed || !protectedPage || signingOut) return Promise.resolve();
      if (checking) return checking;
      checking = (async () => {
        try {
          // Allow the initial/renewed browser token to reach the HTTP-only cookie.
          await auth?.getSession();
          await refresh?.settled();
          if (disposed || signingOut) return;
          let response = await requestSession();
          if (response.status === 401 && auth) {
            const { data } = await auth.getSession();
            if (data.session && !signingOut && !disposed) {
              const renewed = await auth.refreshSession();
              await refresh?.settled();
              if (renewed.data.session && !signingOut && !disposed) response = await requestSession();
            }
          }
          if (disposed || signingOut) return;
          if (response.status === 401) { redirect(); return; }
          if (!response.ok) throw new Error('Session check unavailable');
          setUnavailable(false);
          setVerifiedPath(path);
          setLocked(false);
        } catch {
          hide();
          if (!disposed) setUnavailable(true);
        }
      })().finally(() => { checking = null; });
      return checking;
    };

    const subscription = auth?.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      signingOut = true;
      hide();
      refresh?.stop();
      // Never delete a local username session because an unrelated email login
      // was signed out in another tab. Finish pending refresh writes first.
      void Promise.resolve().then(async () => {
        await refresh?.settled();
        if (disposed) return;
        try {
          const response = await requestSession();
          const session = await response.json();
          if (session.authType === 'supabase') {
            await send('/api/staff/session', { method: 'DELETE', cache: 'no-store' });
          }
        } finally {
          signingOut = false;
          if (!disposed) void verify();
        }
      }).catch(() => { hide(); if (!disposed) setUnavailable(true); });
    }).data.subscription;

    // Catch authentication failures from all staff API callers, including raw
    // fetch users. Permission-denied (403) is not an expired session.
    const guardedFetch: typeof fetch = async (...args) => {
      const response = await send(...args);
      const input = args[0];
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (!disposed && protectedPage && response.status === 401 && url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        hide();
        void verify();
      }
      return response;
    };
    if (protectedPage) window.fetch = guardedFetch;
    const onFocus = () => { hide(); void verify(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') onFocus(); };
    const onStorage = (event: StorageEvent) => { if (event.key === 'staff-session-changed') onFocus(); };
    const timer = protectedPage ? window.setInterval(() => void verify(), 30000) : undefined;
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    void verify();
    return () => {
      disposed = true;
      refresh?.stop();
      subscription?.unsubscribe();
      if (timer) window.clearInterval(timer);
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [path, protectedPage, managesOwnSession]);

  const blocked = protectedPage && (verifiedPath !== path || locked);
  return <>
    {blocked ? <main role="status" style={{ padding: 32, textAlign: 'center' }}>
      {unavailable ? 'Unable to verify your staff session. Reconnecting...' : 'Checking staff session...'}
    </main> : null}
    {/* Keep drafts mounted during focus/network checks, but hide and disable them. */}
    {!protectedPage || verifiedPath === path ? <div inert={blocked} style={{ display: blocked ? 'none' : 'contents' }}>{children}</div> : null}
  </>;
}
