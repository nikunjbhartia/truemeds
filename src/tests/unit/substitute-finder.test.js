// src/tests/unit/substitute-finder.test.js
import { describe, test, expect } from 'vitest';
import {
  normalizeSaltName,
  normalizeStrength,
  parseMedicineInfo,
  compareCompositions,
  mapMatchStatusAndDetails,
  parseMissingIngredients,
  computeMatchPercent
} from '../../js/substitute-finder';

describe('Tier 1: substitute-finder engine unit tests', () => {
  describe('normalizeSaltName', () => {
    test('lowercases and trims whitespace', () => {
      expect(normalizeSaltName('  Pantoprazole Sodium  ')).toBe('pantoprazole sodium');
      expect(normalizeSaltName('PARACETAMOL')).toBe('paracetamol');
    });
  });

  describe('normalizeStrength', () => {
    test('normalizes space and case for strengths', () => {
      expect(normalizeStrength('40 mg')).toBe('40 mg');
      expect(normalizeStrength('40MG')).toBe('40 mg');
      expect(normalizeStrength('1.5 G')).toBe('1.5 g');
      expect(normalizeStrength('1 B')).toBe('1 b');
      expect(normalizeStrength('')).toBe('');
      expect(normalizeStrength(null)).toBe('');
      expect(normalizeStrength(undefined)).toBe('');
      expect(normalizeStrength('N/A')).toBe('n/a');
    });
  });

  describe('parseMedicineInfo', () => {
    test('parses basic fields and prices', () => {
      const prod = {
        productCode: 'p-123',
        brandName: 'Dolo 650',
        manufacturerName: 'Micro Labs',
        packForm: 'Tablet',
        packSize: '15',
        sellingPrice: 30.50,
        mrp: 30.50,
        available: true,
        productUrl: 'dolo-650'
      };
      const info = parseMedicineInfo(prod);
      expect(info.code).toBe('p-123');
      expect(info.name).toBe('Dolo 650');
      expect(info.pack_size).toBe(15);
      expect(info.selling_price).toBe(30.50);
      expect(info.price_per_unit).toBeCloseTo(30.50 / 15, 2);
    });

    test('parses saltComposition list of objects (standard API)', () => {
      const prod = {
        saltComposition: [
          { saltName: 'Pantoprazole', quantity: '40mg' }
        ]
      };
      const info = parseMedicineInfo(prod);
      expect(info.salts).toEqual({ 'Pantoprazole': '40mg' });
    });

    test('parses saltComposition string fallback', () => {
      const prod = {
        saltComposition: 'Domperidone (30 Mg) + Pantoprazole (40 Mg)'
      };
      const info = parseMedicineInfo(prod);
      expect(info.salts).toEqual({
        'Domperidone': '30 Mg',
        'Pantoprazole': '40 Mg'
      });
    });

    test('parses composition with no parens', () => {
      const prod = {
        composition: 'Probiotic Microbes'
      };
      const info = parseMedicineInfo(prod);
      expect(info.salts).toEqual({
        'Probiotic Microbes': ''
      });
    });

    test('parses composition with multiple parts and parens', () => {
      const prod = {
        composition: 'Aspirin (75mg) + Clopidogrel (75mg)'
      };
      const info = parseMedicineInfo(prod);
      expect(info.salts).toEqual({
        'Aspirin': '75mg',
        'Clopidogrel': '75mg'
      });
    });

    test('handles empty composition and salts', () => {
      const prod = {
        saltComposition: null,
        composition: ''
      };
      const info = parseMedicineInfo(prod);
      expect(info.salts).toEqual({});
    });
  });

  describe('compareCompositions', () => {
    test('Exact Match', () => {
      const ref = { 'Pantoprazole': '40mg' };
      const cand = { 'pantoprazole': '40 mg' };
      expect(compareCompositions(ref, cand)).toEqual({
        status: 'Exact Match',
        details: null
      });
    });

    test('Different Strength', () => {
      const ref = { 'Pantoprazole': '40mg' };
      const cand = { 'pantoprazole': '20mg' };
      expect(compareCompositions(ref, cand)).toEqual({
        status: 'Different Strength',
        details: ['Pantoprazole: 20 mg vs 40 mg']
      });
    });

    test('Extra Ingredients', () => {
      const ref = { 'Pantoprazole': '40mg' };
      const cand = { 'pantoprazole': '40mg', 'domperidone': '30mg' };
      expect(compareCompositions(ref, cand)).toEqual({
        status: 'Extra Ingredients',
        details: ['domperidone (30 mg)']
      });
    });

    test('Missing Ingredients', () => {
      const ref = { 'Pantoprazole': '40mg', 'domperidone': '30mg' };
      const cand = { 'pantoprazole': '40mg' };
      expect(compareCompositions(ref, cand)).toEqual({
        status: 'Missing Ingredients',
        details: ['domperidone (30 mg)']
      });
    });

    test('No Match returns Missing Ingredients due to missing reference components', () => {
      const ref = { 'Pantoprazole': '40mg' };
      const cand = { 'Paracetamol': '650mg' };
      expect(compareCompositions(ref, cand)).toEqual({
        status: 'Missing Ingredients',
        details: ['Pantoprazole (40 mg)']
      });
    });
  });

  describe('mapMatchStatusAndDetails', () => {
    test('Queried Brand and exact match mappings', () => {
      expect(mapMatchStatusAndDetails('Queried Brand', [])).toEqual({
        status: 'Queried Brand',
        details: ''
      });
      expect(mapMatchStatusAndDetails('Queried Brand (via Swap)', [])).toEqual({
        status: 'Queried Brand',
        details: 'via Swap'
      });
      expect(mapMatchStatusAndDetails('Exact Match', null)).toEqual({
        status: 'Exact Match',
        details: ''
      });
    });

    test('Different Strength mapping', () => {
      expect(mapMatchStatusAndDetails('Different Strength', ['A: 20mg vs 40mg'])).toEqual({
        status: 'Diff Strength',
        details: 'A: 20mg vs 40mg'
      });
    });

    test('Extra Ingredients mapping', () => {
      expect(mapMatchStatusAndDetails('Extra Ingredients', ['B (10mg)'])).toEqual({
        status: 'Extra Component',
        details: 'B (10mg)'
      });
    });

    test('Missing Ingredients mapping', () => {
      expect(mapMatchStatusAndDetails('Missing Ingredients', ['C (30mg)'])).toEqual({
        status: 'Missing: C',
        details: '30mg'
      });
      expect(mapMatchStatusAndDetails('Missing Ingredients', ['Probiotics'])).toEqual({
        status: 'Missing: Probiotics',
        details: ''
      });
    });
  });

  describe('parseMissingIngredients', () => {
    test('extracts single missing ingredient from status', () => {
      expect(parseMissingIngredients('Missing: Nucleotide', '')).toEqual(new Set(['nucleotide']));
    });

    test('extracts multiple missing ingredients from details including truncated list', () => {
      const details = '12.5 mg), Beta-Carotene (210 mcg), Arachidonic Acid (84.5 mg), Fructooligosaccharides (0.3 g)';
      const missing = parseMissingIngredients('Missing: Nucleotide', details);
      expect(missing).toEqual(new Set([
        'nucleotide',
        'beta-carotene',
        'arachidonic acid',
        'fructooligosaccharides'
      ]));
    });

    test('handles standard list of ingredients in details without starting paren prefix', () => {
      const details = 'Zinc (3.2 mg), Calcium (400 mg)';
      const missing = parseMissingIngredients('', details);
      expect(missing).toEqual(new Set([
        'zinc',
        'calcium'
      ]));
    });
  });

  describe('computeMatchPercent', () => {
    test('returns 100% for exact matches', () => {
      const ref = { 'Paracetamol': '650 mg' };
      const cand = { 'Paracetamol': '650 mg' };
      expect(computeMatchPercent(ref, cand)).toBe(100);
    });

    test('returns correctly scaled percent for different strengths', () => {
      const ref = { 'Paracetamol': '650 mg' };
      const cand = { 'Paracetamol': '125 mg' };
      expect(computeMatchPercent(ref, cand)).toBe(19);
    });

    test('returns correctly weighted Jaccard similarity for missing/extra items', () => {
      // 1 matched, 1 missing -> union size 2, match wt 1 -> 50%
      const ref = { 'Aspirin': '75 mg', 'Glycine': '50 mg' };
      const cand = { 'Aspirin': '75 mg' };
      expect(computeMatchPercent(ref, cand)).toBe(50);
    });
  });
});

