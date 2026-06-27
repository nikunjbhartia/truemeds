// src/tests/unit/api-client.test.js
import { describe, test, expect, vi, afterEach } from 'vitest';
import { fetchSearchResults, parseMedicineInfo } from '../../js/substitute-finder';

describe('Tier 1: api-client (fetchSearchResults)', () => {
  afterEach(() => {
    // Restore global fetch
    globalThis.fetch = vi.fn();
  });

  test('should return resultList on successful upstream fetch', async () => {
    const mockResult = [{ product: { productCode: 'dolo-650' } }];
    const mockResponse = {
      response: {
        resultList: mockResult
      }
    };

    globalThis.fetch = vi.fn(async (url, init) => {
      expect(url).toContain('nal.tmmumbai.in/SearchService/getSearchResult');
      expect(url).toContain('searchString=dolo');
      expect(url).toContain('warehouseId=12');
      expect(url).toContain('page=2');
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const results = await fetchSearchResults('dolo', 2, '12');
    expect(results).toEqual(mockResult);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test('should return empty array if upstream returns 200 but resultList is missing', async () => {
    const mockResponse = { response: {} };
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const results = await fetchSearchResults('dolo');
    expect(results).toEqual([]);
  });

  test('should fallback to proxy when upstream fetch throws (network error)', async () => {
    const mockResult = [{ product: { productCode: 'dolo-proxy' } }];
    const mockResponse = {
      response: {
        resultList: mockResult
      }
    };

    let callCount = 0;
    globalThis.fetch = vi.fn(async (url) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network error');
      } else {
        expect(url).toContain('/api/search');
        expect(url).toContain('searchString=dolo');
        expect(url).toContain('warehouseId=3');
        expect(url).toContain('page=1');
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      }
    });

    const results = await fetchSearchResults('dolo', 1, '3');
    expect(results).toEqual(mockResult);
    expect(callCount).toBe(2);
  });

  test('should fallback to proxy when upstream fetch returns non-ok status', async () => {
    const mockResult = [{ product: { productCode: 'dolo-proxy' } }];
    const mockResponse = {
      response: {
        resultList: mockResult
      }
    };

    let callCount = 0;
    globalThis.fetch = vi.fn(async (url) => {
      callCount++;
      if (callCount === 1) {
        return new Response('Error', { status: 500 });
      } else {
        expect(url).toContain('/api/search');
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      }
    });

    const results = await fetchSearchResults('dolo');
    expect(results).toEqual(mockResult);
    expect(callCount).toBe(2);
  });

  test('should throw error if both upstream and proxy fail', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network error');
    });

    await expect(fetchSearchResults('dolo')).rejects.toThrow('Failed to fetch from both upstream and proxy');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  test('should extract from responseData.elasticProductDetails on upstream path', async () => {
    const mockResult = [{ product: { productCode: 'dolo-live' } }];
    const mockResponse = { responseData: { elasticProductDetails: mockResult } };

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    });

    const results = await fetchSearchResults('dolo');
    expect(results).toEqual(mockResult);
  });

  test('should extract from responseData.elasticProductDetails on proxy fallback path', async () => {
    const mockResult = [{ product: { productCode: 'dolo-proxy-live' } }];
    const mockResponse = { responseData: { elasticProductDetails: mockResult } };

    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network error');
      } else {
        return new Response(JSON.stringify(mockResponse), { status: 200 });
      }
    });

    const results = await fetchSearchResults('dolo');
    expect(results).toEqual(mockResult);
    expect(callCount).toBe(2);
  });

  describe('parseMedicineInfo robust mapping', () => {
    test('handles valid input and maps fields correctly', () => {
      const input = {
        productCode: 'p-123',
        skuName: 'Live Brand',
        brandName: 'Fixture Brand',
        manufacturerName: 'Manuf Co',
        packForm: 'Tablet',
        unit: 'Strip',
        composition: 'Salt A (10mg)',
        available: true,
        productUrlSuffix: 'live-url',
        productUrl: 'fixture-url',
        packSize: '10',
        sellingPrice: '50',
        mrp: '100',
      };
      const res = parseMedicineInfo(input);
      expect(res).toEqual({
        code: 'p-123',
        name: 'Live Brand', // Live key skuName wins over brandName
        manufacturer: 'Manuf Co',
        pack_form: 'Tablet',
        unit: 'Strip',
        composition: 'Salt A (10mg)',
        customerAlsoBoughtMsg: undefined,
        available: true,
        product_url: 'live-url', // Live key productUrlSuffix wins over productUrl
        pack_size: 10,
        selling_price: 50,
        mrp: 100,
        price_per_unit: 5,
        mrp_per_unit: 10,
        salts: { 'Salt A': '10mg' },
      });
    });

    test('retains availability guards', () => {
      // productCode 'unknown' is not available
      expect(parseMedicineInfo({ productCode: 'unknown', skuName: 'X', available: true })).toMatchObject({
        available: false,
      });
      // missing name is not available
      expect(parseMedicineInfo({ productCode: 'p-1', skuName: '', brandName: '', available: true })).toMatchObject({
        available: false,
      });
    });

    test('returns null for null/undefined input', () => {
      expect(parseMedicineInfo(null)).toBeNull();
      expect(parseMedicineInfo(undefined)).toBeNull();
    });

    test('clamps packSize <= 0 to 1.0', () => {
      const res = parseMedicineInfo({ productCode: 'p-1', skuName: 'X', packSize: '0', sellingPrice: '10' });
      expect(res.pack_size).toBe(1.0);
      expect(res.price_per_unit).toBe(10);

      const resNegative = parseMedicineInfo({ productCode: 'p-1', skuName: 'X', packSize: '-5', sellingPrice: '10' });
      expect(resNegative.pack_size).toBe(1.0);
    });
  });
});

