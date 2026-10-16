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
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Button } from '../ui/index.js';
import { NotificationBell } from '../notification-bell.js';

export type NavItem = { readonly to: string; readonly label: string; readonly end?: boolean };

/**
 * Mobile-only account access — the same control Admin's shell already has
 * (admin-shell.tsx), replicated here rather than imported so this file and
 * Admin's stay independent, same as the rest of this component's separation
 * from admin-shell.tsx. Candidate and Employer had no equivalent: on a phone
 * neither the email nor Sign out was reachable at all, since both live
 * behind `sm:`/`lg:` visibility here. This puts them one tap away instead,
 * using the exact same signOut this file already calls elsewhere — no new
 * auth or sign-out logic.
 */
function AccountMenu({ email, onSignOut }: { email: string | undefined; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (email ?? '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Account"
        className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
      >
        {initial}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10"
        >
          <p className="truncate px-1 text-xs text-slate-500">{email}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 flex min-h-11 w-full items-center rounded-lg border border-pub-border px-3 text-sm font-semibold text-pub-navy transition-colors hover:bg-pub-blue-light"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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

  // One style for every portal's mobile drawer, not branched on isPublic —
  // Candidate's own version (a left border, no fill, pub-blue) read as a
  // different component from Employer's and Admin's (filled bg-brand-50,
  // rounded, brand-700) rather than the same drawer in a different portal.
  // desktopLinkClass above keeps the public/brand split: this is mobile-only.
  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${
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
          {/*
            * Mobile-only: hamburger + a compact title, same shape as Admin's
            * mobile header (admin-shell.tsx) — the full logo badge+wordmark
            * moves into the drawer instead of living in this cramped row too.
            * This also puts the hamburger in the same corner Admin uses it
            * in, rather than on the opposite side as before.
            */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="portal-mobile-nav"
              aria-label={`Open ${title.toLowerCase()} navigation`}
              className={`-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg ${
                isPublic ? 'text-pub-navy hover:bg-pub-bg' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span aria-hidden="true" className="text-lg">☰</span>
            </button>
            <span
              className={`min-w-0 truncate font-heading text-sm font-bold ${
                isPublic ? 'text-pub-navy' : 'text-brand-900'
              }`}
            >
              {title} portal
            </span>
          </div>

          {/* min-w-0 lets the link shrink instead of forcing the row wider than
              the viewport on a narrow phone. Desktop only — see above. */}
          {isPublic ? (
            <Link to="/" className="hidden min-w-0 flex-1 items-center gap-2.5 lg:flex">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
                BK
              </span>
              <span className="min-w-0 truncate">
                <span className="block font-heading text-base font-bold leading-tight text-pub-navy">
                  BK Talent Connect
                </span>
                <span className="block text-[11px] leading-tight text-pub-muted">
                  {title} portal
                </span>
              </span>
            </Link>
          ) : (
            <Link to="/" className="hidden min-w-0 truncate lg:block">
              <span className="font-bold tracking-tight text-brand-900">BK Talent Connect</span>
              <span className="ml-2 text-sm text-slate-400">{title}</span>
            </Link>
          )}

          <nav className={`ml-auto hidden items-center lg:flex ${isPublic ? 'gap-5' : 'gap-1'}`}>
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end ?? false} className={desktopLinkClass}>
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
                // lg:, not sm: — matches the breakpoint the hamburger/desktop-nav
                // switch over at (and AccountMenu below), so this and the mobile
                // account icon are never both visible at once.
                className="hidden min-h-9 items-center rounded-lg border border-pub-border px-3.5 text-xs font-semibold text-pub-navy transition-colors hover:bg-pub-blue-light lg:inline-flex"
              >
                Sign out
              </button>
            ) : (
              <Button
                variant="secondary"
                onClick={signOut}
                className="hidden px-3 py-1.5 text-xs lg:inline-flex"
              >
                Sign out
              </Button>
            )}
            <AccountMenu email={user?.email} onSignOut={signOut} />
          </div>
        </div>
      </header>

      {/*
        * Mobile nav drawer — same shape as Admin's (admin-shell.tsx): a
        * clickable backdrop, a left-anchored sliding panel of the same width
        * (w-72, capped at 85vw), a header row carrying the full logo plus an
        * explicit close button, and the nav list below it. Candidate/Employer
        * previously opened an inline panel that pushed page content down with
        * no backdrop and no dedicated close control — this replaces that with
        * the same mechanics Admin already uses, so the three portals behave
        * the same way on mobile. Desktop (`lg:` and up) never renders this.
        */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div
            id="portal-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className={`flex items-center justify-between border-b p-4 ${isPublic ? 'border-pub-border' : 'border-slate-200'}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
                  BK
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-heading text-base font-bold leading-tight text-pub-navy">
                    BK Talent Connect
                  </span>
                  <span className="block text-[11px] leading-tight text-pub-muted">{title} portal</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-pub-navy hover:bg-pub-bg"
              >
                <span aria-hidden="true" className="text-lg">✕</span>
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pb-safe">
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
              <div className={`mt-2 border-t pt-2 ${isPublic ? 'border-pub-border' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-accent-600"
                >
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-7 sm:py-9">
        <Outlet />
      </main>
    </div>
  );
}
