/**
 * Shell shared by the candidate, employer and admin portals.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Button } from '../ui/index.js';

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="shrink-0">
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

          <div className="ml-auto flex items-center gap-3 md:ml-4">
            <span className="hidden text-sm text-slate-500 lg:inline">{user?.email}</span>
            <Button variant="secondary" onClick={signOut} className="px-3 py-1.5 text-xs">
              Sign out
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-200 px-4 py-2 md:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
