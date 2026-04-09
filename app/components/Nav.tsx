'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Shared staff shell stays platform-branded.
 * Public-facing branding comes from processor settings inside page content.
 */
const BRAND = process.env.NEXT_PUBLIC_SITE_NAME || 'Wild Game Butcher Board';
const LOGO_SRC = process.env.NEXT_PUBLIC_LOGO_SRC || '/wgbb-logo.png'; // leading slash for Next/Image/CDN
const ADMIN_HOSTNAME = (process.env.NEXT_PUBLIC_ADMIN_HOSTNAME || 'admin.wildgamebutcherboard.com').trim().toLowerCase();
const STAFF_HOSTNAME = (process.env.NEXT_PUBLIC_STAFF_HOSTNAME || 'staff.wildgamebutcherboard.com').trim().toLowerCase();

function absoluteHostUrl(hostname: string) {
  const host = String(hostname || '').trim().toLowerCase();
  return host ? `https://${host}` : '/';
}

function closeMobileAndDropdown(el?: HTMLElement | null) {
  // Close mobile checkbox menu
  const cb = document.getElementById('nav-check') as HTMLInputElement | null;
  if (cb) cb.checked = false;
  // Close all nav dropdowns so one click fully resets the menu state.
  document.querySelectorAll('nav details').forEach((node) => {
    (node as HTMLDetailsElement).open = false;
  });
  if (el) el.blur();
}

export default function Nav() {
  const pathname = usePathname();
  const [isAdminHost, setIsAdminHost] = useState(false);
  const [staffRole, setStaffRole] = useState<'admin' | 'staff' | 'readonly' | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.host.trim().toLowerCase().split(':')[0] || '';
    setIsAdminHost(host === ADMIN_HOSTNAME);
  }, []);

  useEffect(() => {
    fetch('/api/admin/staff-context', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setStaffRole((json?.processor?.role as 'admin' | 'staff' | 'readonly' | null) || null);
        setPlatformAdmin(json?.platformAdmin === true);
      })
      .catch(() => {});
  }, []);

  const canEdit = staffRole === 'admin' || staffRole === 'staff';
  const canManageSettings = staffRole === 'admin';
  const roleLabel =
    staffRole === 'admin' ? 'Admin' : staffRole === 'staff' ? 'Staff' : staffRole === 'readonly' ? 'Read-only' : '';

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={isAdminHost ? '/admin' : '/'}
            className="brand-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            onClick={() => closeMobileAndDropdown()}
          >
            <img
              src={LOGO_SRC}
              alt="Wild Game Butcher Board"
              width={28}
              height={28}
              style={{ display: 'block', borderRadius: 6 }}
            />
            <span aria-label="Site name">{BRAND}</span>
          </Link>
        </div>

        {/* Mobile menu toggle (CSS-only; see globals.css) */}
        <input id="nav-check" type="checkbox" aria-label="Toggle navigation menu" />
        <label htmlFor="nav-check" className="menu-toggle">Menu</label>

        <nav className="menu" aria-label="Primary">
          {isAdminHost ? (
            <>
              <Link
                className={`item ${isActive('/admin') ? 'active' : ''}`}
                href="/admin"
                onClick={() => closeMobileAndDropdown()}
              >
                Dashboard
              </Link>
              <Link
                className={`item ${isActive('/admin/processors') ? 'active' : ''}`}
                href="/admin/processors"
                onClick={() => closeMobileAndDropdown()}
              >
                Processors
              </Link>
              <Link
                className={`item ${isActive('/admin/users') ? 'active' : ''}`}
                href="/admin/users"
                onClick={() => closeMobileAndDropdown()}
              >
                Users
              </Link>
              <Link
                className={`item ${isActive('/admin/logo-preview') ? 'active' : ''}`}
                href="/admin/logo-preview"
                onClick={() => closeMobileAndDropdown()}
              >
                Branding
              </Link>
              <Link
                className={`item ${isActive('/admin/health') ? 'active' : ''}`}
                href="/admin/health"
                onClick={() => closeMobileAndDropdown()}
              >
                Health
              </Link>
              <Link
                className={`item ${isActive('/staff/account') ? 'active' : ''}`}
                href="/staff/account"
                onClick={() => closeMobileAndDropdown()}
              >
                My Account
              </Link>
              <Link
                className={`item ${isActive('/staff') ? 'active' : ''}`}
                href={absoluteHostUrl(STAFF_HOSTNAME)}
                onClick={() => closeMobileAndDropdown()}
              >
                Staff Site
              </Link>
            </>
          ) : (
            <>
              {canEdit ? (
                <>
                  <Link
                    className={`item ${isActive('/intake') ? 'active' : ''}`}
                    href="/intake"
                    onClick={() => closeMobileAndDropdown()}
                  >
                    Intake
                  </Link>
                  <Link
                    className={`item ${isActive('/scan') ? 'active' : ''}`}
                    href="/scan"
                    onClick={() => closeMobileAndDropdown()}
                  >
                    Scan
                  </Link>
                </>
              ) : null}
              <Link
                className={`item ${isActive('/search') ? 'active' : ''}`}
                href="/search"
                onClick={() => closeMobileAndDropdown()}
              >
                Search
              </Link>

              <details className="dd">
                <summary>Reports</summary>
                <div className="dropdown-menu" role="menu">
                  <div className="dropdown-group-label">Operations</div>
                  <Link href="/reports/calls" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Call Report
                  </Link>
                  <Link href="/reports/called" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Called / Pickups
                  </Link>
                  <Link href="/reports/specialty" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Specialty
                  </Link>
                  <Link href="/reports/print-queue" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Print Queue
                  </Link>
                  <Link href="/reports/state-form" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    State Form
                  </Link>

                  <div className="dropdown-group-label">Public Intake</div>
                  <Link href="/overnight/review" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Needs Tag
                  </Link>
                  <Link href="/reports/removed-public-intakes" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Removed Public Intakes
                  </Link>

                  <div className="dropdown-group-label">Communication</div>
                  <Link href="/reports/notifications" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                    Notifications
                  </Link>
                  {canManageSettings ? (
                    <div className="dropdown-group-label">Owner</div>
                  ) : null}
                  {canManageSettings ? (
                    <Link href="/reports/balances" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                      Balances
                    </Link>
                  ) : null}
                  {canManageSettings ? (
                    <Link href="/reports/owner-insights" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                      Owner Insights
                    </Link>
                  ) : null}
                  {canManageSettings ? (
                    <Link href="/reports/activity" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>
                      Activity History
                    </Link>
                  ) : null}
                </div>
              </details>

              <details className="dd">
                <summary>Help</summary>
                <div className="dropdown-menu" role="menu">
                  <Link href="/tips" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>Tip Sheet</Link>
                  <Link href="/faq" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>FAQ</Link>
                  <Link href="/help/overnight-qr" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>Public Intake QR</Link>
                  <Link href="/staff/account" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>My Account</Link>
                  {canManageSettings ? <Link href="/staff/team" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>Staff Team</Link> : null}
                  {canManageSettings ? <Link href="/admin/settings" onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>Public Site Settings</Link> : null}
                  {platformAdmin ? <Link href={absoluteHostUrl(ADMIN_HOSTNAME)} onClick={(e) => closeMobileAndDropdown(e.currentTarget)}>Platform Admin</Link> : null}
                </div>
              </details>
            </>
          )}

          <Link
            className={`item ${isActive('/staff/logout') ? 'active' : ''}`}
            href="/staff/logout"
            onClick={() => closeMobileAndDropdown()}
            style={{ marginLeft: 'auto' }}
          >
            Logout
          </Link>
          {!isAdminHost && roleLabel ? (
            <span
              className="item"
              style={{
                pointerEvents: 'none',
                opacity: 0.95,
                border: '1px solid rgba(200,138,61,.24)',
                borderRadius: 999,
                paddingInline: 12,
                background: 'rgba(21,20,19,.92)',
              }}
            >
              Role: {roleLabel}
            </span>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
