/**
 * Shell shared by the candidate, employer and admin portals.
 *
 * `variant="public"` aligns the header with the public marketing site's own
 * navbar (components/layout/public-navbar.tsx) — same logo badge, wordmark
 * treatment and underline active-state — so the Candidate Portal reads as
 * the same product a visitor already saw on the public pages. It is opt-in
 * per portal (CandidateLayout only, below) precisely so Employer and Admin
 * keep their existing, already-shipped look untouched.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Button } from '../ui/index.js';
import { NotificationBell } from '../notification-bell.js';

export type NavItem = { readonly to: string; readonly label: string; readonly end?: boolean };

export function PortalLayout({
  title,
  nav,
  variant = 'brand',
}: {
  title: string;
  nav: readonly NavItem[];
  variant?: 'brand' | 'public';
}) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPublic = variant === 'public';

  async function signOut() {
    await api.post('/auth/logout');
    // refresh() first, unchanged from before: it invalidates and refetches
    // ['auth', 'me'] itself, so this has to run while that query still exists
    // in the cache — clearing it out from under refresh() is what silently
    // broke the refetch when tried the other way round.
    await refresh();
    // Every candidate/employer/admin-scoped query (profile, applications,
    // notifications, interviews, ...) is keyed without a user id, because the
    // app only ever has one signed-in user at a time — except across this
    // exact boundary. Without clearing here, the next person to sign in on
    // this tab inherits whoever was signed in before them until something
    // happens to remount the query or the page is hard-refreshed. 'auth' is
    // excluded because refresh() just populated it correctly above.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    navigate('/login', { replace: true });
  }

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    isPublic
      ? `px-1 pb-1 text-sm font-semibold transition-colors ${
          isActive
            ? 'text-pub-blue shadow-[inset_0_-2px_0_var(--color-pub-blue)]'
            : 'text-pub-text/75 hover:text-pub-navy'
        }`
      : `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
        }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    isPublic
      ? `flex min-h-11 items-center border-l-[3px] pl-3.5 text-sm font-semibold ${
          isActive ? 'border-pub-blue text-pub-blue' : 'border-transparent text-pub-text/75'
        }`
      : `flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
        }`;

  return (
    <div className={`min-h-screen ${isPublic ? 'bg-pub-bg' : 'bg-slate-50'}`}>
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur-sm ${
          isPublic ? 'border-pub-border bg-white/95' : 'border-slate-200 bg-white/95'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* min-w-0 lets the link shrink instead of forcing the row wider than
              the viewport on a narrow phone. */}
          {isPublic ? (
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
                BK
              </span>
              <span className="min-w-0 truncate">
                <span className="block font-heading text-base font-bold leading-tight text-pub-navy">
                  BK Talent Connect
                </span>
                <span className="hidden text-[11px] leading-tight text-pub-muted sm:block">
                  {title} portal
                </span>
              </span>
            </Link>
          ) : (
            <Link to="/" className="min-w-0 truncate">
              <span className="font-bold tracking-tight text-brand-900">BK Talent Connect</span>
              <span className="ml-2 hidden text-sm text-slate-400 sm:inline">{title}</span>
            </Link>
          )}

          {/* min-w-0 + overflow-x-auto: a nav with more items than fit (Admin
              has ten) scrolls within its own box instead of forcing the whole
              header wider than the viewport. Inert for Candidate/Employer,
              whose short navs never come close to needing it. */}
          <nav
            className={`ml-auto hidden min-w-0 items-center overflow-x-auto md:flex ${isPublic ? 'gap-5' : 'gap-1'} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) => `shrink-0 ${desktopLinkClass({ isActive })}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-4 md:gap-2">
            <span
              className={`hidden max-w-[16rem] truncate text-sm lg:inline ${
                isPublic ? 'text-pub-muted' : 'text-slate-500'
              }`}
            >
              {user?.email}
            </span>
            <NotificationBell />
            {isPublic ? (
              <button
                type="button"
                onClick={signOut}
                className="hidden min-h-9 items-center rounded-lg border border-pub-border px-3.5 text-xs font-semibold text-pub-navy transition-colors hover:bg-pub-blue-light sm:inline-flex"
              >
                Sign out
              </button>
            ) : (
              <Button
                variant="secondary"
                onClick={signOut}
                className="hidden px-3 py-1.5 text-xs sm:inline-flex"
              >
                Sign out
              </Button>
            )}
            {/* 44px touch target. */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="portal-mobile-nav"
              aria-label="Toggle navigation"
              className={`flex size-11 items-center justify-center rounded-lg md:hidden ${
                isPublic ? 'text-pub-navy hover:bg-pub-bg' : 'text-slate-600 hover:bg-slate-100'
              }`}
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
            className={`border-t px-4 py-2 pb-safe md:hidden ${isPublic ? 'border-pub-border' : 'border-slate-200'}`}
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                onClick={() => setMenuOpen(false)}
                className={mobileLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-accent-600 sm:hidden"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:py-9">
        <Outlet />
      </main>
    </div>
  );
}
