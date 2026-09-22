import type { Metadata, Viewport } from 'next';
import { buildFaviconUri } from '@/lib/build-favicon-uri';
import { getLogoSrc } from '@/lib/get-logo-src';
import { inter, FONT_CLASS_MAP } from '@/lib/fonts';
import { TemplateLayout } from '@/components/custom/template-layout';
import { LogoSrcProvider } from '@/components/custom/logo-src-provider';
import { TemplateI18nProvider } from '../lib/i18n/provider';
import { PwaRegister } from '@/components/pwa-register';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import '@/app/globals.css';
import './globals.css';
import './custom.css';

export const viewport: Viewport = {
  themeColor: '#FF444F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export function generateMetadata(): Metadata {
  const faviconUri = buildFaviconUri();
  const title = process.env.NEXT_PUBLIC_DERIV_APP_NAME?.trim() || 'Deriv Digits Trading App';
  return {
    title,
    description: 'A white-label trading application powered by Deriv — AI Bot for digit trading with real-time digit dominance analysis.',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title,
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        ...(faviconUri ? [{ url: faviconUri }] : []),
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  };
}

const fontClass =
  FONT_CLASS_MAP[process.env.NEXT_PUBLIC_FONT_FAMILY ?? 'Inter'] ??
  inter.className;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const logoSrc = getLogoSrc();
  return (
    <html lang="en" className="h-full lg:h-auto" suppressHydrationWarning>
      <body
        className={`${fontClass} bg-background flex min-h-dvh flex-col overflow-hidden max-lg:h-dvh max-lg:overflow-hidden lg:block lg:h-auto lg:min-h-screen lg:overflow-x-hidden lg:overflow-y-auto`}
      >
        <PwaRegister />
        <PwaInstallPrompt />
        <TemplateI18nProvider>
          <TemplateLayout>
            <LogoSrcProvider logoSrc={logoSrc}>{children}</LogoSrcProvider>
          </TemplateLayout>
        </TemplateI18nProvider>
      </body>
    </html>
  );
}
