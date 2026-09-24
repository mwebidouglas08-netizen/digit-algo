'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <h2 className="text-lg font-semibold">App failed to load</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground break-words">{error.message || 'Unknown error'}</p>
        <button onClick={reset} className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Reload
        </button>
      </body>
    </html>
  );
}
