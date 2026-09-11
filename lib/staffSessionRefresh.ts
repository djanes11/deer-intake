type Auth = { onAuthStateChange(callback: (event: string, session: { access_token: string } | null) => void): { data: { subscription: { unsubscribe(): void } } } };

export function subscribeStaffSessionRefresh(auth: Auth, send: typeof fetch = fetch, pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))) {
  let disposed = false;
  let queue = Promise.resolve();
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!session || !['INITIAL_SESSION', 'TOKEN_REFRESHED', 'SIGNED_IN'].includes(event)) return;
    const accessToken = session.access_token;
    // Run outside Supabase's synchronous callback; serialize writes so older tokens cannot win.
    queue = queue.then(async () => {
      for (let attempt = 0; attempt < 3 && !disposed; attempt++) {
        try {
          const response = await send('/api/staff/session', {
            method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
            body: JSON.stringify({ accessToken, refreshOnly: true }),
          });
          if (response.ok || response.status === 401) return;
        } catch { /* Retry a temporary network failure. */ }
        await pause(1000 * (attempt + 1));
      }
    }).catch(() => {});
  });
  return {
    settled: () => queue,
    stop: () => { disposed = true; data.subscription.unsubscribe(); },
  };
}
