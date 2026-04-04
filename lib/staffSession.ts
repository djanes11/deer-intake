export const STAFF_ACCESS_COOKIE = 'staff_access_token';

export function setStaffAccessCookie(accessToken: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STAFF_ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax${secure}`;
}

export function clearStaffAccessCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${STAFF_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
