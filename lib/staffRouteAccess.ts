/** Customer intake/status links remain public; operational screens require staff. */
export function isProtectedStaffPath(path: string, publicMode = false) {
  if (path === '/') return !publicMode;
  if (path === '/intake') return true;
  return ['/admin', '/search', '/scan', '/board', '/butcher', '/reports', '/overnight/review', '/staff/account', '/staff/team', '/faq']
    .some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

export function staffLoginUrl(path: string, search = '') {
  const next = path.startsWith('/') && !path.startsWith('//') ? path + search : '/';
  return '/staff/login?next=' + encodeURIComponent(next);
}
