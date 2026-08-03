/**
 * Base UI primitives.
 *
 * Deliberately plain: these five need no Radix behaviour. When P2 brings in
 * Select, Modal, Tabs and Toast — where focus trapping, escape handling and
 * scroll locking are genuinely hard to get right — those come from shadcn/ui
 * rather than being hand-rolled.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-white text-brand-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-brand-700 hover:bg-brand-50',
  danger: 'bg-accent-600 text-white hover:bg-accent-500 disabled:bg-accent-400',
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
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

const CONTROL_BASE =
  'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500';

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

export function Select({
  invalid,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={`${CONTROL_BASE} ${invalid ? 'border-accent-400' : 'border-slate-300'} ${className}`}
    >
      {children}
    </select>
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
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-4 text-sm ${ALERT_STYLES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'slate', children }: { tone?: string; children: ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    brand: 'bg-brand-100 text-brand-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}
