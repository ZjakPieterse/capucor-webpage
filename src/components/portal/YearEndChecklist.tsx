'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  YEAR_END_CHECKLIST,
  YEAR_END_TOTAL_ITEMS,
} from '@/config/yearEndChecklist';

const STORAGE_KEY = 'capucor:year-end-checklist:v1';

type CheckedMap = Record<string, boolean>;

const EMPTY: CheckedMap = {};

// localStorage-backed external store. Module scope keeps the snapshot reference
// stable across renders — useSyncExternalStore requires getSnapshot to return a
// cached value until the underlying data actually changes (a fresh JSON.parse
// each call would loop). Reading via the store (rather than setState in an
// effect) is the hydration-safe, lint-clean way to restore persisted state:
// getServerSnapshot returns EMPTY so SSR + first hydration render match, then
// React picks up the restored value after mount.
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheValue: CheckedMap = EMPTY;

function readSnapshot(): CheckedMap {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheValue = raw ? (JSON.parse(raw) as CheckedMap) : EMPTY;
    } catch {
      cacheValue = EMPTY;
    }
  }
  return cacheValue;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Pick up changes made in other tabs.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function writeStore(next: CheckedMap): void {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // private mode / quota — the in-memory cache below still updates the UI.
  }
  cacheRaw = raw;
  cacheValue = next;
  listeners.forEach((l) => l());
}

function clearStore(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  cacheRaw = null;
  cacheValue = EMPTY;
  listeners.forEach((l) => l());
}

// false during SSR + first hydration render, true thereafter — without a
// setState-in-effect. Lets us hold back the progress figure until mounted so a
// returning user never sees a misleading "0 of N" flash.
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function YearEndChecklist() {
  const checked = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
  const isClient = useIsClient();

  const setItem = useCallback((id: string, value: boolean) => {
    writeStore({ ...readSnapshot(), [id]: value });
  }, []);

  const reset = useCallback(() => clearStore(), []);

  const doneCount = Object.values(checked).filter(Boolean).length;
  const percent = Math.round((doneCount / YEAR_END_TOTAL_ITEMS) * 100);

  return (
    <div>
      {/* Progress */}
      <div className="premium-glass mb-6 rounded-xl border border-white/10 bg-card/80 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-sm font-semibold">
            {isClient ? (
              <>
                {doneCount} of {YEAR_END_TOTAL_ITEMS} gathered
              </>
            ) : (
              <span className="text-muted-foreground">Loading your progress…</span>
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={isClient ? percent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: isClient ? `${percent}%` : '0%' }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Progress is saved on this device. It is a prep aid — your accountant still does the final close.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {YEAR_END_CHECKLIST.map((section) => (
          <section
            key={section.id}
            className="premium-glass rounded-xl border border-white/10 bg-card/80 p-6"
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {section.title}
            </h2>
            <ul className="space-y-3.5">
              {section.items.map((item) => {
                const isChecked = Boolean(checked[item.id]);
                return (
                  <li key={item.id} className="flex items-start gap-3">
                    <Checkbox
                      id={item.id}
                      checked={isChecked}
                      onCheckedChange={(val) => setItem(item.id, val === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <Label
                        htmlFor={item.id}
                        className={`text-sm leading-relaxed cursor-pointer ${
                          isChecked ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {item.label}
                      </Label>
                      {item.hint && (
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                          {item.hint}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
