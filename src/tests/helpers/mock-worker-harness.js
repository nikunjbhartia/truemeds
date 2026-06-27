// web/src/tests/helpers/mock-worker-harness.js
// Drives functions/api/search.js as a pure async function in Node.
// Vitest with Node 18+ provides global Request, Response, Headers, URL, fetch.

import { vi } from 'vitest';

/**
 * callWorker — invoke the Pages Function with synthesised CF context.
 *
 *  opts.method      'GET' | 'POST' | 'OPTIONS' | ...
 *  opts.path        e.g. '/api/search?searchString=dolo&warehouseId=1'
 *  opts.headers     request headers (object)
 *  opts.body        request body (string)
 *  opts.origin      Request origin host, default https://medicine-portal.pages.dev
 *  opts.upstream    function (Request) => Response | Promise<Response>
 *                     — stub for the upstream Truemeds call. Required for happy-path.
 *  opts.env         object passed as env (e.g. { UPSTREAM_BASE: '...' })
 *
 * Returns { response, upstreamCalls }.
 */
export async function callWorker({
  method = 'GET',
  path = '/api/search',
  headers = {},
  body = undefined,
  origin = 'https://medicine-portal.pages.dev',
  upstream = null,
  env = {},
} = {}) {
  // 1. Build Request.
  const url = new URL(path, origin).toString();
  const request = new Request(url, {
    method,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? undefined : body,
  });
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      request.headers.set(k, v);
    }
  }


  // 2. Stub the worker's outgoing fetch.
  const upstreamCalls = [];
  const fetchSpy = vi.fn(async (input, init) => {
    const upstreamReq = input instanceof Request
      ? input
      : new Request(input, { ...init, headers: undefined });
    if (init && init.headers) {
      const hdrs = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
      for (const [k, v] of hdrs.entries()) {
        upstreamReq.headers.set(k, v);
      }
    }
    upstreamCalls.push({
      url: upstreamReq.url,
      method: upstreamReq.method,
      headers: Object.fromEntries(
        Array.from(upstreamReq.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
      ),
    });
    if (!upstream) {
      // Default: 200 with empty envelope.
      return new Response(JSON.stringify({ data: { elasticProductDetails: [] } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    const result = await upstream(upstreamReq);
    return result instanceof Response ? result : new Response(JSON.stringify(result), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
  const prevFetch = globalThis.fetch;
  globalThis.fetch = fetchSpy;

  // 3. Dynamic import of the worker.
  //    Path is relative to this file; adjust if the project root differs.
  const mod = await import('../../../functions/api/search.js');
  const onRequest = mod.onRequest || mod.default;
  if (typeof onRequest !== 'function')
    throw new Error('functions/api/search.js must export onRequest (or default).');

  // 4. Synthesised CF context.
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
  const data = {};
  const params = {};

  try {
    const response = await onRequest({ request, env, ctx, params, data, next: async () => new Response(null, {status: 404}) });
    if (!(response instanceof Response))
      throw new Error('onRequest must return a Response');
    return { response, upstreamCalls };
  } finally {
    globalThis.fetch = prevFetch;
  }
}
