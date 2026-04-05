export const STAFF_ACCESS_COOKIE = 'staff_access_token';
export const STAFF_LOCAL_SESSION_COOKIE = 'staff_local_session';

export function setStaffAccessCookie(accessToken: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STAFF_ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax${secure}`;
}

export function clearStaffAccessCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${STAFF_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setLocalStaffSessionCookie(sessionToken: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STAFF_LOCAL_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; SameSite=Lax${secure}`;
}

export function clearLocalStaffSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${STAFF_LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
