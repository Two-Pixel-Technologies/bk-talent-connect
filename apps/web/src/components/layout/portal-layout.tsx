/**
 * Shell shared by the candidate, employer and admin portals.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Button } from '../ui/index.js';
import { NotificationBell } from '../notification-bell.js';

export type NavItem = { readonly to: string; readonly label: string; readonly end?: boolean };

export function PortalLayout({ title, nav }: { title: string; nav: readonly NavItem[] }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await api.post('/auth/logout');
    await refresh();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* min-w-0 lets the link shrink instead of forcing the row wider than
              the viewport on a narrow phone. */}
          <Link to="/" className="min-w-0 truncate">
            <span className="font-bold text-brand-900">BK Talent Connect</span>
            <span className="ml-2 hidden text-sm text-slate-400 sm:inline">{title}</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-4 md:gap-2">
            <span className="hidden max-w-[16rem] truncate text-sm text-slate-500 lg:inline">
              {user?.email}
            </span>
            <NotificationBell />
            <Button
              variant="secondary"
              onClick={signOut}
              className="hidden px-3 py-1.5 text-xs sm:inline-flex"
            >
              Sign out
            </Button>
            {/* 44px touch target. */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="portal-mobile-nav"
              aria-label="Toggle navigation"
              className="flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <span aria-hidden="true" className="text-lg">
                {menuOpen ? '✕' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="portal-mobile-nav"
            className="border-t border-slate-200 px-4 py-2 pb-safe md:hidden"
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-accent-600 sm:hidden"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
