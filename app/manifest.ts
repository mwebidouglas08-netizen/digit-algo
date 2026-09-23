import type { MetadataRoute } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function manifest(): MetadataRoute.Manifest | any {
  const name = process.env.NEXT_PUBLIC_DERIV_APP_NAME?.trim() || 'Deriv Digits Trading App';
  return {
    name,
    short_name: name.length > 18 ? 'Digits Algo' : name,
    description: 'A white-label trading application powered by Deriv — AI Bot for digit trading with real-time digit dominance analysis.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#FF444F',
    categories: ['finance'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'AI Bot',
        url: '/',
        description: 'Open AI trading bot',
      },
    ],
  };
}
