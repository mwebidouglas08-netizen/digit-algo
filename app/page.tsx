'use client';

import { LiveDigits } from '../components/live-digits';

/**
 * Deployed app — always renders the real trading app immediately.
 * No fetch gate, no blank div, no 404 — ensures page loads on mobile even if
 * /app-config.json is missing or SW is stale. Configurable styles are optional
 * and applied only if public/app-config.json exists at runtime via LiveDigits.
 */
export default function DigitsPage() {
  return <LiveDigits />;
}
