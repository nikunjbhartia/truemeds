// web/src/tests/helpers/mock-fetch.js
// Routing fetch mock keyed by URL pattern + decoded searchString + page.
// Loads raw API fixture from src/tests/fixtures/api/<slug>/[<saltSubdir>/]page-N.json.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(__dirname, '..', 'fixtures', 'api');

/** sanitize a searchString → filesystem-safe directory segment */
const slug = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9+]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * installFetchMock(routeMap?)
 *   routeMap : optional override { [searchString]: { [page]: payload | Response | () => Response } }
 *
 * Without overrides, the mock derives a path from the search string:
 *   /api/search?searchString=Pantoprazole&page=1
 *     → fixtures/api/pantoprazole/page-1.json
 *
 * For multi-salt fanout fixtures, place under brand/<salt-subdir>:
 *   fixtures/api/pantomore_dsr/pantoprazole/page-1.json
 * and pass an aliasing routeMap that maps the salt searchString to that dir.
 */
export function installFetchMock({
  routeMap = {},
  baseDir = null,       // optional: pin to a single brand subtree
  onCall = null,        // (url, init) => void  — for assertions
} = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, 'http://localhost');
    const searchString = u.searchParams.get('searchString') ?? '';
    const page = u.searchParams.get('page') ?? '1';
    calls.push({ url, init, searchString, page });
    onCall?.(url, init);

    // 0. Handle golden mock data files request
    if (u.pathname.startsWith('/data/') || u.pathname.includes('_substitutes.json')) {
      const filename = u.pathname.split('/').pop();
      const filePath = resolve(__dirname, '..', 'fixtures', 'golden', filename);
      if (existsSync(filePath)) {
        return new Response(readFileSync(filePath, 'utf-8'), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
    }

    // 1. Explicit override?
    if (routeMap[searchString]?.[page] != null) {
      const v = routeMap[searchString][page];
      const payload = typeof v === 'function' ? await v() : v;
      if (payload instanceof Response) return payload;
      return new Response(JSON.stringify(payload), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    // 2. Filesystem lookup.
    const sub = slug(searchString);
    const candidates = baseDir
      ? [resolve(FIXTURE_ROOT, baseDir, sub, `page-${page}.json`),
         resolve(FIXTURE_ROOT, baseDir, `page-${page}.json`)]
      : [resolve(FIXTURE_ROOT, sub, `page-${page}.json`)];

    const hit = candidates.find(p => existsSync(p));
    if (hit) {
      return new Response(readFileSync(hit, 'utf-8'), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    // 3. Pagination terminator — empty result envelope.
    if (page !== '1') {
      return new Response(JSON.stringify({ data: { elasticProductDetails: [] } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`mock-fetch: no fixture for searchString="${searchString}" page=${page} (looked in ${candidates.join(', ')})`);
  });

  return {
    calls,
    callsFor: (s) => calls.filter(c => c.searchString === s),
    assertCalledWith: (s, expectedPages = ['1']) => {
      const got = calls.filter(c => c.searchString === s).map(c => c.page).sort();
      if (JSON.stringify(got) !== JSON.stringify([...expectedPages].sort()))
        throw new Error(`expected pages ${expectedPages} for "${s}", got ${got}`);
    },
    restore: () => globalThis.__restoreFetch?.(),
  };
}

/** Quick helper: pin all fetches to one brand subtree. */
export const installFetchMockFromDir = (brandDir) =>
  installFetchMock({ baseDir: brandDir });
