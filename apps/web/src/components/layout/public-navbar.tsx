/**
 * Header for the public site (Home and For Candidates today, the other
 * public pages next).
 *
 * A nav item whose href starts with `/#` points at a Home section that has
 * no dedicated page yet (For Employers, Contact) and renders as a plain
 * anchor; once a page exists for it, point content/site.ts at the real path
 * instead and it renders as a router NavLink with active-state styling here
 * automatically — no change needed in this file.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { publicNav } from '../../content/site.js';

function PublicNavLink({
  href,
  onClick,
  className,
  children,
}: {
  href: string;
  onClick?: (() => void) | undefined;
  className: string;
  children: ReactNode;
}) {
  if (href.startsWith('/#')) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    );
  }
  return (
    <NavLink
      to={href}
      end={href === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `${className} ${isActive ? 'text-pub-blue shadow-[inset_0_-2px_0_var(--color-pub-blue)]' : ''}`
      }
    >
      {children}
    </NavLink>
  );
}

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const registerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!registerOpen) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!registerRef.current?.contains(event.target as Node)) setRegisterOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setRegisterOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [registerOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-pub-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
            BK
          </span>
          <span className="min-w-0 truncate">
            <span className="block font-heading text-base font-bold leading-tight text-pub-navy">
              {publicNav.logo.title}
            </span>
            <span className="hidden text-[11px] leading-tight text-pub-muted sm:block">
              {publicNav.logo.subtitle}
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {publicNav.links.map((item) => (
            <PublicNavLink
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-pub-text/80 transition-colors hover:bg-pub-blue-light hover:text-pub-navy"
            >
              {item.label}
            </PublicNavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-4">
          <Link
            to="/login"
            className="hidden min-h-10 items-center rounded-lg border border-pub-border px-4 text-sm font-medium text-pub-navy hover:bg-pub-bg sm:inline-flex"
          >
            Login
          </Link>

          <div ref={registerRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setRegisterOpen((o) => !o)}
              aria-expanded={registerOpen}
              aria-haspopup="menu"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-pub-blue px-4 text-sm font-medium text-white hover:bg-pub-navy"
            >
              Register
              <span aria-hidden="true" className="text-xs">▾</span>
            </button>
            {registerOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-pub-border bg-white shadow-lg"
              >
                <Link
                  role="menuitem"
                  to="/register/candidate"
                  onClick={() => setRegisterOpen(false)}
                  className="flex min-h-11 items-center px-4 text-sm text-pub-text hover:bg-pub-blue-light"
                >
                  As a Candidate
                </Link>
                <Link
                  role="menuitem"
                  to="/register/employer"
                  onClick={() => setRegisterOpen(false)}
                  className="flex min-h-11 items-center px-4 text-sm text-pub-text hover:bg-pub-blue-light"
                >
                  As an Employer
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-nav"
            aria-label="Toggle navigation"
            className="flex size-11 items-center justify-center rounded-lg text-pub-navy hover:bg-pub-bg lg:hidden"
          >
            <span aria-hidden="true" className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="public-mobile-nav" className="border-t border-pub-border px-4 py-3 pb-safe lg:hidden">
          {publicNav.links.map((item) => (
            <PublicNavLink
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-pub-text hover:bg-pub-blue-light"
            >
              {item.label}
            </PublicNavLink>
          ))}
          <div className="mt-2 flex gap-2 border-t border-pub-border pt-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-pub-border text-sm font-medium text-pub-navy"
            >
              Login
            </Link>
            <Link
              to="/register/candidate"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-pub-blue text-sm font-medium text-white"
            >
              Register
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
