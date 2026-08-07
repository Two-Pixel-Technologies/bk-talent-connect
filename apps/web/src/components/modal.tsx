/**
 * A dialog that behaves like one.
 *
 * The two hand-rolled modals in this app set `role="dialog" aria-modal="true"`
 * and then provided none of what those attributes promise: no focus trap, no
 * Escape, no click-outside, no scroll lock. Tab walked straight out into the
 * page behind, which for a screen-reader or keyboard user means the dialog is
 * decoration. The notification bell got this right, so the app was also
 * inconsistent with itself.
 *
 * Bottom sheet on a phone, centred card from `sm` up — a fixed-width dialog
 * overflows a 360px viewport.
 */

import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  label,
  onClose,
  children,
  size = 'md',
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Remember where focus was so it can go back — otherwise closing a dialog
    // dumps keyboard users at the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Only the backdrop itself, so a drag that ends outside the panel does
        // not close a dialog the user is still filling in.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-safe sm:rounded-2xl ${
          size === 'lg' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
