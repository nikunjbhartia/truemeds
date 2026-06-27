// web/src/tests/setup.js — global test environment.
// Runs ONCE per worker before any test file; per-test hooks reset state.

import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ────────────────────────────────────────────────────────────────────────────
// 1. matchMedia mock — happy-dom does not implement it.
//    Drives JS-state-based responsive switching (see hooks/useMediaQuery.js).
// ────────────────────────────────────────────────────────────────────────────
let __viewportWidth = 1280;
const __mqListeners = new Set();

function evaluateQuery(query) {
  // Parse just enough of the CSS spec for our use:
  // (min-width: 768px) / (max-width: 767px) / (min-width: 1024px)
  const minMatch = /\(min-width:\s*(\d+)px\)/.exec(query);
  const maxMatch = /\(max-width:\s*(\d+)px\)/.exec(query);
  let ok = true;
  if (minMatch) ok = ok && __viewportWidth >= Number(minMatch[1]);
  if (maxMatch) ok = ok && __viewportWidth <= Number(maxMatch[1]);
  return ok;
}

function createMQL(query) {
  const mql = {
    media: query,
    get matches() { return evaluateQuery(query); },
    onchange: null,
    _listeners: new Set(),
    addEventListener(_t, cb) { this._listeners.add(cb); },
    removeEventListener(_t, cb) { this._listeners.delete(cb); },
    addListener(cb) { this._listeners.add(cb); },     // legacy
    removeListener(cb) { this._listeners.delete(cb); },
    dispatchEvent(ev) { this._listeners.forEach(cb => cb(ev)); return true; },
  };
  __mqListeners.add(mql);
  return mql;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true, configurable: true,
  value: vi.fn(createMQL),
});

// Public helper for tests.
globalThis.__setViewportWidth = (px) => {
  __viewportWidth = px;
  // Notify every live MQL.
  __mqListeners.forEach(mql => {
    const ev = { matches: mql.matches, media: mql.media };
    mql._listeners.forEach(cb => cb(ev));
    if (typeof mql.onchange === 'function') mql.onchange(ev);
  });
  // Mirror to window.innerWidth for any code that reads it directly.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });
  window.dispatchEvent(new Event('resize'));
};

// ────────────────────────────────────────────────────────────────────────────
// 2. LocalStorage mock — some node environments lack it.
// ────────────────────────────────────────────────────────────────────────────
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

if (typeof window !== 'undefined') {
  if (!window.localStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: new LocalStorageMock(),
      writable: true,
      configurable: true
    });
  }
  if (!window.sessionStorage) {
    Object.defineProperty(window, 'sessionStorage', {
      value: new LocalStorageMock(),
      writable: true,
      configurable: true
    });
  }
}

class NoopObserver { observe(){} unobserve(){} disconnect(){} takeRecords(){return [];} }
globalThis.ResizeObserver ??= NoopObserver;
globalThis.IntersectionObserver ??= NoopObserver;

// ────────────────────────────────────────────────────────────────────────────
// 3. crypto.randomUUID — monotonic, deterministic per test.
// ────────────────────────────────────────────────────────────────────────────
let __uuidCounter = 0;
const nextUuid = () => {
  __uuidCounter += 1;
  const tail = __uuidCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
};
// Don't replace the whole crypto object — happy-dom relies on subtle.
if (!globalThis.crypto) globalThis.crypto = {};
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  configurable: true, writable: true, value: nextUuid,
});

// ────────────────────────────────────────────────────────────────────────────
// 4. fetch — must be explicitly set per suite via helpers/mock-fetch.js.
//    Default behaviour: throw, so accidental real-network calls fail loud.
// ────────────────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = vi.fn(() => {
  throw new Error('fetch not mocked — install via installFetchMock() in test setup');
});
globalThis.__restoreFetch = () => { globalThis.fetch = realFetch; };

// ────────────────────────────────────────────────────────────────────────────
// 5. Per-test hooks.
// ────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  __uuidCounter = 0;
  __viewportWidth = 1280;        // default to desktop; tests override
  if (typeof window !== 'undefined') {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  }
  vi.spyOn(Math, 'random').mockReturnValue(0.42);
  globalThis.fetch.mockReset?.();
});

afterEach(() => {
  cleanup();                     // RTL unmount
  vi.restoreAllMocks();
});
