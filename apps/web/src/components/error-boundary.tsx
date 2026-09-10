/**
 * Top-level error boundary.
 *
 * Without one, any render error unmounts the whole tree and the user gets a
 * blank white page with no explanation and no way forward — which is exactly
 * the failure mode that is hardest to diagnose from a support message.
 *
 * It also handles the post-deploy case: a user holding an old bundle navigates
 * to a lazily-loaded route whose chunk no longer exists. That surfaces as a
 * module-load error, and the fix is a reload, which we do once automatically
 * rather than asking the user to work it out.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_FLAG = 'bktc:chunk-reload';

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`;
  return (
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Reload once for a stale-bundle failure; the flag stops a reload loop if
    // the chunk is genuinely missing rather than merely outdated.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      return;
    }
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">Something went wrong</h1>
        <p className="mt-2 text-slate-600">
          Sorry - this page ran into a problem. Your saved work is not affected.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-lg bg-brand-600 px-5 font-medium text-white hover:bg-brand-700"
          >
            Reload the page
          </button>
          <a
            href="/"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 font-medium text-brand-700 hover:bg-slate-50"
          >
            Back to home
          </a>
        </div>

        {import.meta.env.DEV && (
          <pre className="mt-8 overflow-x-auto rounded-lg bg-slate-100 p-4 text-left text-xs text-slate-700">
            {error.stack ?? error.message}
          </pre>
        )}
      </main>
    );
  }
}
