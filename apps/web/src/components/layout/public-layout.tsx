/**
 * Shell for the public site. Wraps Home today; every later public page
 * (For Candidates, For Employers, About, Contact, …) nests under this route
 * so the navbar, footer and WhatsApp float stay in exactly one place.
 */

import { Outlet } from 'react-router-dom';
import { WhatsAppGlyph } from '../icons/public-icons.js';
import { home } from '../../content/site.js';
import { PublicNavbar } from './public-navbar.js';
import { PublicFooter } from './public-footer.js';

/** Standard WhatsApp brand green — deliberately outside the pub-* palette. */
const WHATSAPP_GREEN = '#25D366';

export function PublicLayout() {
  const { whatsapp } = home.contact;
  // BK's WhatsApp number is a realistic placeholder pending the real one
  // (see content/site.ts) — the link still opens wa.me directly rather than
  // scrolling to a section, since the button should always behave like a
  // real WhatsApp CTA. Swap `whatsapp.href` once the real number lands and
  // this component needs no further change.
  const isPlaceholder = !whatsapp.href.startsWith('https://wa.me/');

  return (
    <div className="min-h-screen bg-pub-bg font-public text-pub-text">
      <PublicNavbar />
      <Outlet />
      <PublicFooter />

      <a
        href={isPlaceholder ? '#contact' : whatsapp.href}
        target={isPlaceholder ? undefined : '_blank'}
        rel={isPlaceholder ? undefined : 'noopener noreferrer'}
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-xl"
        style={{ background: WHATSAPP_GREEN, boxShadow: '0 10px 25px -5px rgba(37, 211, 102, 0.5)' }}
      >
        <WhatsAppGlyph className="size-7" />
      </a>
    </div>
  );
}
