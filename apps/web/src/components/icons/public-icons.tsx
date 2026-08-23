/**
 * Hand-drawn line icons for the public site.
 *
 * No icon library is a dependency of this app, and the brief asked for
 * custom vector work rather than an embedded reference image — so these are
 * plain inline SVG, sized entirely by the `className` the caller passes
 * (typically a Tailwind `size-*`), stroke-based so they inherit `currentColor`.
 */

import type { ReactElement, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconShieldCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

export function IconUserCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M4 20c.6-3.6 3-5.5 6-5.5s5 1.4 5.7 4" />
      <path d="m15.5 13.5 2 2 3.5-3.5" />
    </svg>
  );
}

export function IconAward(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="9" r="5.25" />
      <path d="M9 13.5 7.5 21 12 18.5 16.5 21 15 13.5" />
    </svg>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5" />
      <path d="m9 13 2 2 4-4.5" />
    </svg>
  );
}

export function IconLifeBuoy(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" />
    </svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 20c.5-3.4 2.6-5 5.5-5s5 1.6 5.5 5" />
      <path d="M15.5 6a3 3 0 0 1 0 5.8" />
      <path d="M15.2 15c2.4.4 3.8 1.9 4.3 5" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function IconZap(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.5 2.5 4.5 14h5.5l-1.5 7.5 8-11.5h-5.5l1.5-7.5Z" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" />
      <path d="M10 20.5V17h4v3.5" />
    </svg>
  );
}

export function IconFactory(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 20.5v-8l5 3v-3l5 3v-3l5.5 3.3v4.7Z" />
      <path d="M3.5 20.5h16" />
      <path d="M8 20.5v-3M12.5 20.5v-3" />
    </svg>
  );
}

export function IconFlask(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3.5h4M10.5 3.5V9L5.8 18a2 2 0 0 0 1.8 3h8.8a2 2 0 0 0 1.8-3L13.5 9V3.5" />
      <path d="M8.5 15h7" />
    </svg>
  );
}

export function IconCog(props: IconProps) {
  const teeth = Array.from({ length: 6 }, (_, i) => i * 60);
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <circle cx="12" cy="12" r="7.5" strokeDasharray="2.2 3" />
      {teeth.map((angle) => (
        <line
          key={angle}
          x1="12"
          y1="3"
          x2="12"
          y2="5.4"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function IconCpu(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9.25" y="9.25" width="5.5" height="5.5" rx="0.75" />
      <path d="M9 3v2.3M12 3v2.3M15 3v2.3M9 18.7V21M12 18.7V21M15 18.7V21M3 9h2.3M3 12h2.3M3 15h2.3M18.7 9H21M18.7 12H21M18.7 15H21" />
    </svg>
  );
}

export function IconDroplet(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3s6 6.8 6 11a6 6 0 1 1-12 0c0-4.2 6-11 6-11Z" />
    </svg>
  );
}

export function IconUserPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5" />
      <path d="M18.5 8v5M16 10.5h5" />
    </svg>
  );
}

export function IconFileCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
      <path d="m9 14 2 2 4-4.2" />
    </svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 3 3 10.5l7 2.5 2 7L21 3Z" />
      <path d="M21 3 10 14" />
    </svg>
  );
}

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 3.5 1 5 2 6H4c1-1 2-2.5 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.25" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconImage(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.75" />
      <path d="m4 17 5-5 3.5 3.5L16.5 11 20 15" />
    </svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v11H9.5L5 20v-3.5H4v-11Z" />
      <path d="M8 9.5h8M8 12.7h5" />
    </svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 6.5 8 6.5 8-6.5" />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5h3.2l1.3 4-2 1.6a11 11 0 0 0 5 5l1.6-2 4 1.3V18a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z" />
    </svg>
  );
}

/** Outline "phone in a chat bubble" glyph, matching this set's hand-drawn line style. */
export function IconWhatsapp(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.2A8.5 8.5 0 1 0 12 3.5Z" />
      <path d="M8.7 8.4c.2-.4.4-.5.6-.5h.5c.15 0 .3 0 .45.4.15.4.5 1.3.55 1.4.05.1.08.2 0 .35a1 1 0 0 1-.2.3c-.1.1-.2.25-.3.35-.1.1-.2.2-.1.4.12.2.5.85 1.1 1.4.75.65 1.35.85 1.55.95.2.1.3.08.4-.05.12-.14.5-.55.6-.75.1-.2.25-.15.4-.1.15.06 1 .48 1.2.57.18.1.3.13.35.2.05.08.05.42-.1.85-.15.42-.85.8-1.2.85-.3.06-.7.09-2.1-.45-1.8-.7-2.95-2.55-3.05-2.67-.1-.13-.75-1-.75-1.9 0-.9.47-1.34.65-1.53Z" />
    </svg>
  );
}

export function IconLeaf(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 5c-8 0-13 4-13 12 0 .5 0 .8.1 1C14 18 19 13 19 5Z" />
      <path d="M6.5 17.5 15 9" />
    </svg>
  );
}

/** A simple "in" monogram badge — not a reproduction of any brand mark. */
export function IconLinkedin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="8" cy="8.3" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8 11v6.5" />
      <path d="M12 17.5V13a2.3 2.3 0 0 1 4.6 0v4.5" />
      <path d="M12 11v1.2" />
    </svg>
  );
}

/** Lookup used by content/site.ts so copy can name an icon by key. */
export const PUBLIC_ICONS = {
  shieldCheck: IconShieldCheck,
  userCheck: IconUserCheck,
  award: IconAward,
  clipboardCheck: IconClipboardCheck,
  lifeBuoy: IconLifeBuoy,
  target: IconTarget,
  users: IconUsers,
  eye: IconEye,
  zap: IconZap,
  factory: IconFactory,
  flask: IconFlask,
  cog: IconCog,
  cpu: IconCpu,
  droplet: IconDroplet,
  userPlus: IconUserPlus,
  fileCheck: IconFileCheck,
  send: IconSend,
  briefcase: IconBriefcase,
  clock: IconClock,
  mail: IconMail,
  phone: IconPhone,
  chat: IconChat,
  bell: IconBell,
  lock: IconLock,
  building: IconBuilding,
  image: IconImage,
  linkedin: IconLinkedin,
  whatsapp: IconWhatsapp,
} satisfies Record<string, (props: IconProps) => ReactElement>;

export type PublicIconKey = keyof typeof PUBLIC_ICONS;

/**
 * Filled brand glyph for the floating WhatsApp CTA — deliberately not part
 * of the hand-drawn outline set above. A round green button reads as
 * "WhatsApp" only with the familiar filled handset-in-bubble mark; the
 * outline style used everywhere else would be ambiguous at that size.
 */
export function WhatsAppGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" {...props}>
      <path d="M16.04 4C9.6 4 4.36 9.22 4.36 15.66c0 2.13.58 4.14 1.6 5.87L4 28l6.62-1.9a11.6 11.6 0 0 0 5.42 1.35h.01c6.44 0 11.68-5.22 11.68-11.66C27.73 9.35 22.48 4 16.04 4Zm0 21.32h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.93 1.13 1.16-3.83-.23-.4a9.62 9.62 0 0 1-1.48-5.01c0-5.33 4.34-9.66 9.75-9.66 2.6 0 5.05 1.02 6.89 2.85a9.68 9.68 0 0 1 2.86 6.85c0 5.33-4.34 9.62-9.76 9.62Zm5.35-7.23c-.29-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.96-.93 1.16-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.87-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.5.07-.77.37-.26.29-1 .98-1 2.4 0 1.4 1.03 2.76 1.17 2.95.15.2 2.02 3.08 4.9 4.32.68.3 1.22.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.74-.71 1.98-1.4.25-.68.25-1.27.17-1.4-.07-.13-.26-.2-.55-.35Z" />
    </svg>
  );
}
