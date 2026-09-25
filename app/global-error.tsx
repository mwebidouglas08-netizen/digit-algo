'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('GlobalError:', error, error.stack);
  }, [error]);
  return (
    <html lang="en">
      <body className="bg-background flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <h2 className="text-lg font-semibold">App failed to load</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground break-words">{error.message || 'Unknown error'}</p>
        {error.stack && <pre className="mt-3 max-h-40 overflow-auto text-left text-[11px] bg-muted p-2 rounded w-full max-w-md whitespace-pre-wrap">{error.stack.slice(0, 2000)}</pre>}
        {error.digest && <p className="mt-1 text-xs text-muted-foreground">Digest: {error.digest}</p>}
        <button onClick={reset} className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Reload
        </button>
      </body>
    </html>
  );
}
