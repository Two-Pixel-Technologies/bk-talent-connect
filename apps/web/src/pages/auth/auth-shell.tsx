import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  wide?: boolean | undefined;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-accent-500 uppercase">
          Takai Labs
        </p>
        <p className="mt-1 text-2xl font-bold text-brand-900">BK Talent Connect</p>
      </Link>

      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
