/**
 * Base UI primitives.
 *
 * Deliberately plain: these five need no Radix behaviour. When P2 brings in
 * Select, Modal, Tabs and Toast — where focus trapping, escape handling and
 * scroll locking are genuinely hard to get right — those come from shadcn/ui
 * rather than being hand-rolled.
 */

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700 disabled:bg-brand-300 disabled:shadow-none',
  secondary:
    'bg-white text-brand-700 border border-slate-300 shadow-sm shadow-slate-900/[0.02] hover:bg-slate-50 hover:border-slate-400',
  ghost: 'text-brand-700 hover:bg-brand-50',
  danger:
    'bg-accent-600 text-white shadow-sm shadow-accent-900/10 hover:bg-accent-500 disabled:bg-accent-400 disabled:shadow-none',
};

export function Button({
  variant = 'primary',
  className = '',
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled ?? loading}
      // min-h-11 is 44px — the minimum reliable touch target. Without it the
      // padding alone gives ~42px, which is a measurably worse tap accuracy.
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

/**
 * Wraps a control with its label, hint and error. The error is wired via
 * aria-describedby and aria-invalid rather than being colour alone.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-0.5 text-accent-600">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm text-accent-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * text-base (16px) is deliberate: iOS Safari zooms the viewport when focusing
 * an input smaller than 16px, which throws the user out of the form layout.
 * sm:text-sm restores the tighter size on pointer devices.
 *
 * min-h-11 (44px) meets the minimum touch target size on mobile.
 */
const CONTROL_BASE =
  'w-full min-h-11 rounded-lg border px-3 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

export function Input({
  invalid,
  className = '',
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  // React 19 passes ref as a normal prop to function components.
  ref?: Ref<HTMLInputElement> | undefined;
}) {
  return (
    <input
      ref={ref}
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={`${CONTROL_BASE} ${invalid ? 'border-accent-400' : 'border-slate-300'} ${className}`}
    />
  );
}

export function Textarea({
  invalid,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={`${CONTROL_BASE} ${invalid ? 'border-accent-400' : 'border-slate-300'} ${className}`}
    />
  );
}

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")";

/**
 * Every dropdown in the app goes through this one component, so it is the
 * single place that decides how a dropdown looks and where its menu opens.
 *
 * It used to render a real native <select>. Native option popups are drawn by
 * the browser/OS, not this page, and the browser decides — based on how much
 * room is left below versus above — whether to open the list upward. Nothing
 * in CSS can override that choice, and when a field sits in the lower half of
 * the page the list opened upward and got clipped against the top of the
 * viewport. This hand-rolled combobox (the same trigger-button-plus-absolute-
 * panel shape as the account menu and the skills-suggestion list elsewhere in
 * this app) replaces it so every menu opens downward, every time, with no
 * exceptions — the thing a native select could not reliably promise.
 *
 * The public API is unchanged on purpose: still `<option value=...>` children,
 * still a `(e) => e.target.value`-shaped onChange, still the same id/required/
 * invalid/disabled props. Every existing call site — two dozen of them, across
 * all three portals — keeps working without being touched.
 */
export function Select({
  id,
  value,
  onChange,
  disabled,
  invalid,
  required,
  className = '',
  children,
  'aria-label': ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listboxId = `${controlId}-listbox`;

  const options = Children.toArray(children)
    .filter(isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>)
    .map((el) => ({
      value: String(el.props.value ?? ''),
      label: typeof el.props.children === 'string' ? el.props.children : String(el.props.children ?? ''),
      disabled: Boolean(el.props.disabled),
    }));

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [maxListHeight, setMaxListHeight] = useState(256);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  // Always opens downward — the one behavioural change this component exists
  // for (see the file comment). A trigger sitting near the bottom of the
  // viewport (scrolled there by the browser's own "bring into view on focus",
  // or just because that is where the field falls on a long form) could
  // leave less room below it than any option list needs. Rather than let the
  // panel run past the bottom edge — or fall back to opening upward, which is
  // exactly the native-select behaviour this component exists to avoid —
  // this scrolls the trigger to the middle of the viewport first, so there is
  // reliably room below it, then sizes the panel to what is actually left.
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    if (roomBelow < 200) {
      containerRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.bottom - 16;
    setMaxListHeight(Math.max(120, Math.min(256, available)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    setActiveIndex(-1);
    // Synthesized to match what every call site already reads: e.target.value.
    // The native <select> this replaced never gave callers anything more than
    // that, so nothing downstream needs more than that either.
    onChange?.({ target: { value: option.value } } as ChangeEvent<HTMLSelectElement>);
  }

  function nextEnabledIndex(from: number, direction: 1 | -1): number {
    if (options.length === 0) return -1;
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = direction === 1 ? (i + 1 >= options.length ? 0 : i + 1) : i <= 0 ? options.length - 1 : i - 1;
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const currentIndex = options.findIndex((o) => o.value === value);

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openAt(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => nextEnabledIndex(i, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => nextEnabledIndex(i, -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={controlId}
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openAt(options.findIndex((o) => o.value === value)))}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${controlId}-option-${activeIndex}` : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${controlId}-error` : undefined}
        // Same CONTROL_BASE sizing as every text input, and the same
        // background-image-chevron-plus-pr-10 technique the native select
        // used, so the trigger is pixel-for-pixel identical to before.
        className={`${CONTROL_BASE} truncate bg-white bg-no-repeat pr-10 text-left ${
          invalid ? 'border-accent-400' : 'border-slate-300'
        } ${className}`}
        style={{
          backgroundImage: SELECT_CHEVRON,
          backgroundPosition: 'right 0.65rem center',
          backgroundSize: '1.25rem 1.25rem',
        }}
      >
        {selected ? selected.label : (options[0]?.label ?? '')}
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ maxHeight: maxListHeight }}
          className="absolute top-full left-0 z-40 mt-1 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${controlId}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => !option.disabled && setActiveIndex(index)}
              onMouseDown={(e) => {
                // mousedown, not click — fires before the trigger's blur would
                // otherwise close the panel and swallow the selection.
                e.preventDefault();
                commit(index);
              }}
              className={`px-3 py-2 text-sm ${
                option.disabled
                  ? 'cursor-not-allowed text-slate-400'
                  : `cursor-pointer ${index === activeIndex ? 'bg-brand-50 text-brand-900' : 'text-slate-700'}`
              } ${option.value === value ? 'font-semibold' : ''}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertTone, string> = {
  info: 'bg-brand-50 text-brand-900 border-brand-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  error: 'bg-red-50 text-red-900 border-red-200',
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${ALERT_STYLES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

/**
 * The base surface for every section on a portal page.
 *
 * The border/shadow pairing is deliberately light — a hairline border plus a
 * shadow of almost nothing — so sections read as distinct surfaces without
 * every card competing for attention the way a heavier shadow would.
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/** Never leave a list view blank — an empty screen reads as a bug. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'slate', children }: { tone?: string; children: ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/70',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] ?? tones.slate}`}
    >
      {children}
    </span>
  );
}
