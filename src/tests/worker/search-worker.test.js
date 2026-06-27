// src/tests/worker/search-worker.test.js
import { describe, test, expect, vi } from 'vitest';
import { callWorker } from '../helpers/mock-worker-harness';

describe('Tier 0: Cloudflare Worker (search proxy)', () => {
  test('W1: OPTIONS preflight', async () => {
    const { response } = await callWorker({
      method: 'OPTIONS',
      headers: { 'Origin': 'https://www.truemeds.in' }
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.truemeds.in');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
  });

  test('W2: GET /api/search?searchString=dolo&warehouseId=1 happy path', async () => {
    const mockResponse = { data: { elasticProductDetails: [{ productCode: 'dolo-650' }] } };
    const { response, upstreamCalls } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo&warehouseId=1',
      upstream: () => new Response(JSON.stringify(mockResponse), { status: 200 }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(mockResponse);

    expect(upstreamCalls.length).toBe(1);
    const call = upstreamCalls[0];
    expect(call.url).toContain('/SearchService/getSearchResult');
    expect(call.url).toContain('searchString=dolo');
    expect(call.url).toContain('warehouseId=1');
    expect(call.url).toContain('isMultiSearch=true');
    expect(call.url).toContain('platform=web');

    expect(call.headers['origin']).toBe('https://www.truemeds.in');
    expect(call.headers['referer']).toBe('https://www.truemeds.in/');
    expect(call.headers['accept']).toBe('application/json');
    expect(call.headers['user-agent']).toContain('Mozilla');
  });

  test('W3: Missing searchString', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?warehouseId=1',
    });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('searchString required');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('W4: POST /api/search not allowed', async () => {
    const { response } = await callWorker({
      method: 'POST',
      path: '/api/search?searchString=dolo',
      body: JSON.stringify({ dolo: true })
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, OPTIONS');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('W5: Upstream 502 error passthrough', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
      upstream: () => new Response('Internal Server Error', { status: 500 }),
    });
    expect(response.status).toBe(502);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('W6: Upstream throws (network unreachable)', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
      upstream: () => { throw new Error('DNS resolution failed'); },
    });
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBe('upstream_unreachable');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('W7: Upstream returns invalid/non-JSON response', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
      upstream: () => new Response('<html>Error</html>', { status: 200 }),
    });
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toBe('upstream_invalid_json');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('W8: Query allow-list rejection (>120 chars)', async () => {
    const longString = 'a'.repeat(121);
    const { response } = await callWorker({
      method: 'GET',
      path: `/api/search?searchString=${longString}`,
    });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid search string');
  });

  test('W8: Query allow-list rejection (control characters)', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo%0A', // includes newline char
    });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid search string');
  });

  test('W9: Query passthrough (page and warehouseId)', async () => {
    const { response, upstreamCalls } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo&warehouseId=12&page=3&unknownParam=hello',
    });
    expect(response.status).toBe(200);
    expect(upstreamCalls.length).toBe(1);
    const call = upstreamCalls[0];
    expect(call.url).toContain('warehouseId=12');
    expect(call.url).toContain('page=3');
    expect(call.url).not.toContain('unknownParam');
  });

  test('W10: Header sanitisation', async () => {
    const { response, upstreamCalls } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
      headers: {
        'Cookie': 'session=abc',
        'Authorization': 'Bearer token',
        'X-Client-Header': 'hello'
      }
    });
    expect(response.status).toBe(200);
    expect(upstreamCalls.length).toBe(1);
    const call = upstreamCalls[0];
    expect(call.headers['cookie']).toBeUndefined();
    expect(call.headers['authorization']).toBeUndefined();
    expect(call.headers['x-client-header']).toBeUndefined();
  });

  test('W11: Response Content-Type pinned', async () => {
    const { response } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  test('W12: Cache hint for 200 vs no-store for error', async () => {
    const { response: okResponse } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
    });
    expect(okResponse.status).toBe(200);
    expect(okResponse.headers.get('cache-control')).toBe('public, max-age=60');

    const { response: errResponse } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=', // triggers 400
    });
    expect(errResponse.status).toBe(400);
    expect(errResponse.headers.get('cache-control')).toBe('no-store');
  });
  test('W13: Ignore client incoming UA/client-hints and replace with valid pool defaults, but forward Accept-Language', async () => {
    const validUAs = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Mobile/15E148 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    ];

    const { response, upstreamCalls } = await callWorker({
      method: 'GET',
      path: '/api/search?searchString=dolo',
      headers: {
        'User-Agent': 'Custom-Agent/1.0',
        'Sec-Ch-Ua': '"Custom Brand";v="1"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"CustomOS"',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      }
    });

    expect(response.status).toBe(200);
    expect(upstreamCalls.length).toBe(1);
    const call = upstreamCalls[0];

    // Assert client incoming User-Agent and Sec-Ch-Ua were stripped / ignored and replaced with pool defaults
    expect(call.headers['user-agent']).not.toBe('Custom-Agent/1.0');
    expect(call.headers['sec-ch-ua']).not.toBe('"Custom Brand";v="1"');
    expect(validUAs).toContain(call.headers['user-agent']);

    // Assert incoming Accept-Language header is forwarded when present
    expect(call.headers['accept-language']).toBe('fr-FR,fr;q=0.9');
  });

  test('W14: Dynamic rotation/randomization from the pool on subsequent calls', async () => {
    // Restore Math.random mock from setup.js to allow true random selection in the pool
    Math.random.mockRestore();

    // Assert subsequent mock calls generate different randomized headers from the pool
    const distinctUAs = new Set();
    for (let i = 0; i < 20; i++) {
      const { upstreamCalls } = await callWorker({
        method: 'GET',
        path: '/api/search?searchString=dolo',
        headers: {}
      });
      distinctUAs.add(upstreamCalls[0].headers['user-agent']);
    }
    expect(distinctUAs.size).toBeGreaterThan(1);
  });
});
