// src/tests/adversarial/substitute-finder.adversarial.test.js
import { describe, test, expect, vi } from 'vitest';
import {
  normalizeStrength,
  parseMedicineInfo,
  compareCompositions,
  mapMatchStatusAndDetails,
  findSubstitutes
} from '../../js/substitute-finder';

describe('Adversarial Tests: substitute-finder', () => {

  describe('Gap 1: Strength Normalization Truncation', () => {
    test('does not truncate concentration strengths like mg/ml', () => {
      // Expected: "10 mg/5 ml" or similar.
      // Current implementation returns "10 mg" due to regex prefix matching without '$'.
      const result = normalizeStrength('10mg/5ml');
      expect(result).toBe('10 mg/5 ml'); 
    });

    test('does not truncate multi-strength combo specifications', () => {
      // Expected: "40 mg+12.5 mg" or similar.
      // Current implementation returns "40 mg" and discards the rest.
      const result = normalizeStrength('40mg+12.5mg');
      expect(result).toBe('40 mg + 12.5 mg');
    });
  });

  describe('Gap 2: Multi-Ingredient Missing Mappings Details Corruption', () => {
    test('correctly maps multiple missing ingredients without details corruption', () => {
      const matchDetails = ['Domperidone (30 mg)', 'Pantoprazole (40 mg)'];
      const result = mapMatchStatusAndDetails('Missing Ingredients', matchDetails);
      
      // Expected: clean status and details
      // Current code returns: { status: 'Missing: Domperidone', details: '30 mg), Pantoprazole (40 mg' }
      expect(result.status).toBe('Missing: Domperidone, Pantoprazole');
      expect(result.details).toBe('30 mg, 40 mg');
    });
  });

  describe('Gap 3: Missing/Unmatched Ingredients Dropped During Parsing', () => {
    test('does not drop ingredients with special characters like % or / in name', () => {
      const prod = {
        saltComposition: 'Alcohol 95% (10ml) + Purified Water (90ml)',
        productCode: 'p-111',
        skuName: 'Test Solution'
      };
      const info = parseMedicineInfo(prod);
      
      // Expected: both salts should be present
      // Current code: only 'Purified Water' is matched; 'Alcohol 95%' is silently dropped.
      expect(info.salts).toHaveProperty('Alcohol 95%');
      expect(info.salts['Alcohol 95%']).toBe('10ml');
      expect(info.salts).toHaveProperty('Purified Water');
      expect(info.salts['Purified Water']).toBe('90ml');
    });
  });

  describe('Gap 4: Input Validation & Error Handling', () => {
    test('compareCompositions handles null reference or candidate salts gracefully', () => {
      // Expected: shouldn't throw a TypeError, but return "No Match" or similar status
      // Current code: throws TypeError
      expect(() => compareCompositions(null, { 'pantoprazole': '40mg' })).not.toThrow();
      expect(() => compareCompositions({ 'pantoprazole': '40mg' }, null)).not.toThrow();
    });

    test('parseMedicineInfo handles non-numeric prices gracefully without NaN propagation', () => {
      const prod = {
        productCode: 'p-999',
        skuName: 'Free Sample',
        sellingPrice: 'free',
        mrp: 'free',
        packSize: 10
      };
      const info = parseMedicineInfo(prod);
      
      // Expected: price falls back to 0 or handles conversion gracefully
      // Current code: parses to NaN, price_per_unit becomes NaN
      expect(info.selling_price).not.toBeNaN();
      expect(info.mrp).not.toBeNaN();
      expect(info.price_per_unit).not.toBeNaN();
    });
  });

  describe('Gap 5: Candidate Suggestion Salts Overwrite', () => {
    test('does not blindly overwrite suggestion salts with parent product salts', async () => {
      // Mock search endpoint for query "Pantomore" and salt searches
      const searchMock = vi.fn(async (query) => {
        const qLower = query.toLowerCase();
        if (qLower === 'pantomore') {
          return [
            {
              product: {
                productCode: 'parent-code',
                brandName: 'Pantomore DSR',
                manufacturerName: 'Morepen',
                available: true,
                saltComposition: 'Domperidone (30mg) + Pantoprazole (40mg)',
                composition: 'Domperidone (30mg) + Pantoprazole (40mg)',
                sellingPrice: 100,
                mrp: 100,
                packSize: 10
              },
              suggestion: null
            }
          ];
        }
        if (qLower === 'domperidone' || qLower === 'pantoprazole') {
          return [
            {
              product: {
                productCode: 'parent-code',
                brandName: 'Pantomore DSR',
                manufacturerName: 'Morepen',
                available: true,
                saltComposition: 'Domperidone (30mg) + Pantoprazole (40mg)',
                composition: 'Domperidone (30mg) + Pantoprazole (40mg)',
                sellingPrice: 100,
                mrp: 100,
                packSize: 10
              },
              suggestion: {
                productCode: 'sugg-code',
                brandName: 'Walapan 40',
                manufacturerName: 'Wala',
                available: true,
                // Suggestion has its own different salts (only Pantoprazole 40mg)
                saltComposition: 'Pantoprazole (40mg)',
                composition: 'Pantoprazole (40mg)',
                sellingPrice: 50,
                mrp: 50,
                packSize: 10
              }
            }
          ];
        }
        return [];
      });

      // Inject the mock
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url) => {
        const u = new URL(url);
        const q = u.searchParams.get('searchString');
        const res = await searchMock(q);
        return new Response(JSON.stringify({ response: { resultList: res } }), { status: 200 });
      });

      try {
        const output = await findSubstitutes('Pantomore');
        // Once fixed, Walapan 40 (which has only Pantoprazole) should not be classified as Exact Match
        // for a parent that has Domperidone + Pantoprazole.
        const exactAlts = output.alternatives.exact.filter(a => a.brand === 'Walapan 40');
        expect(exactAlts.length).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

});
