import 'server-only';
// ⚠️ INTERNAL NEXT.JS API (decision: Zjak, 2026-10-13, option a). Next has no
// public way to tell `next build` prerendering from a runtime ISR
// regeneration, and the pricing page must behave differently in each (see
// app/(site)/pricing/page.tsx). Next is pinned exact (docs/deploy.md);
// src/__tests__/pricing-isr.test.ts fails if an upgrade moves or renames this
// so the fallback below never silently becomes the only behaviour.
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';

/** True while `next build` prerenders the current page. */
export function isBuildPrerender(): boolean {
  return workAsyncStorage.getStore()?.isBuildTimePrerendering === true;
}
