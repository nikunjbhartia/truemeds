// src/tests/golden-parity.test.js
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Helper to parse numeric values with tolerance
function assertClose(val1, val2, label = '', tolerance = 0.01) {
  const diff = Math.abs(val1 - val2);
  if (diff > tolerance) {
    console.error(`PARITY FAILURE [${label}]: MD value: ${val1}, JSON value: ${val2}, Diff: ${diff}`);
  }
  expect(diff).toBeLessThanOrEqual(tolerance);
}

function extractNumber(str) {
  if (!str) return NaN;
  const match = str.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

function parseMarkdownTableRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const parsedRecords = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    
    // Split by pipe and remove empty boundary elements
    const cells = trimmed.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
    
    // Skip header and separator lines
    if (cells.length === 0) continue;
    if (cells[0].toLowerCase().includes('category') || cells[0].toLowerCase().includes('no.')) continue;
    if (cells[0].startsWith(':') || cells[0].startsWith('-')) continue;
    if (cells.some(c => c.toLowerCase().includes('no matches found'))) continue;

    if (cells.length === 7) {
      // Summary Recommendations table row
      const category = cells[0].trim();
      const brand = cells[1].replace(/\*\*/g, '').trim();
      const mrp = extractNumber(cells[2]);
      const price = extractNumber(cells[3]);
      const unitPrice = extractNumber(cells[4]);
      const savings = extractNumber(cells[5]);
      
      parsedRecords.push({
        category,
        brand,
        mrp,
        price,
        unitPrice,
        savings,
        source: 'summary'
      });
    } else if (cells.length === 10) {
      // Alternatives tables row
      const brand = cells[2].replace(/\*\*/g, '').replace(/\*+.*\*+/g, '').trim();
      const mrp = extractNumber(cells[5]);
      const price = extractNumber(cells[6]);
      const unitPrice = extractNumber(cells[7]);
      const savings = extractNumber(cells[8]);

      parsedRecords.push({
        brand,
        mrp,
        price,
        unitPrice,
        savings,
        source: 'alternatives'
      });
    }
  }

  return parsedRecords;
}

describe('Tier 4 Golden Oracle Parity Tests', () => {
  const reportsDir = path.resolve(__dirname, '../../python/reports');
  const goldenDir = path.resolve(__dirname, 'fixtures/golden');

  const testCases = [
    {
      slug: 'ecosprin_75_tablet_14',
      mdFile: 'ecosprin_75_tablet_14_substitutes.md',
      jsonFile: 'ecosprin_75_tablet_14_substitutes.json'
    },
    {
      slug: 'pan_40_tablet_15',
      mdFile: 'pan_40_tablet_15_substitutes.md',
      jsonFile: 'pan_40_tablet_15_substitutes.json'
    },
    {
      slug: 'ecoflora_capsule_30',
      mdFile: 'ecoflora_capsule_30_substitutes.md',
      jsonFile: 'ecoflora_capsule_30_substitutes.json'
    },
    {
      slug: 'pantomore_dsr_capsule_10',
      mdFile: 'pantomore_dsr_capsule_10_substitutes.md',
      jsonFile: 'pantomore_dsr_capsule_10_substitutes.json'
    },
    {
      slug: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm',
      mdFile: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm_substitutes.md',
      jsonFile: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm_substitutes.json'
    }
  ];

  testCases.forEach(({ slug, mdFile, jsonFile }) => {
    test(`assert parity for ${slug} between markdown report and golden json`, () => {
      const mdPath = path.join(reportsDir, mdFile);
      const jsonPath = path.join(goldenDir, jsonFile);

      expect(fs.existsSync(mdPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);

      const mdRecords = parseMarkdownTableRows(mdPath);
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      // Flatten all alternatives in JSON data
      const jsonAlternatives = [];
      if (jsonData.recommendations) {
        jsonData.recommendations.forEach(rec => {
          jsonAlternatives.push({ ...rec, source: 'summary' });
        });
      }
      
      const exacts = jsonData.alternatives?.exact || [];
      const strengths = jsonData.alternatives?.different_strength || [];
      const partials = jsonData.alternatives?.partial || [];

      exacts.forEach(item => jsonAlternatives.push({ ...item, source: 'alternatives' }));
      strengths.forEach(item => jsonAlternatives.push({ ...item, source: 'alternatives' }));
      partials.forEach(item => jsonAlternatives.push({ ...item, source: 'alternatives' }));

      // Match each mdRecord with corresponding json record
      mdRecords.forEach(mdRec => {
        if (!mdRec.brand) return;

        // Find match in jsonAlternatives by brand name and source category
        const match = jsonAlternatives.find(j => {
          if (!j.brand) return false;

          const cleanJBrand = j.brand.replace(/\*\*/g, '').trim().toLowerCase();
          const cleanMDBrand = mdRec.brand.replace(/\s*\(.*\)/g, '').trim().toLowerCase();
          
          if (mdRec.source === 'summary') {
            return cleanJBrand === cleanMDBrand && j.category && j.category.toLowerCase() === mdRec.category.toLowerCase() && j.source === mdRec.source;
          }

          return cleanJBrand === cleanMDBrand && j.source === mdRec.source;
        });

        if (match) {
          // Assert parity with 0.01 tolerance for price, mrp, unit price, and savings percent
          if (!isNaN(mdRec.price) && match.price != null) {
            assertClose(mdRec.price, match.price, `${mdRec.brand} price`);
          }
          if (!isNaN(mdRec.mrp) && match.mrp != null) {
            assertClose(mdRec.mrp, match.mrp, `${mdRec.brand} mrp`);
          }
          if (!isNaN(mdRec.unitPrice) && match.unit_price != null) {
            assertClose(mdRec.unitPrice, match.unit_price, `${mdRec.brand} unit_price`);
          }
          if (!isNaN(mdRec.savings) && match.savings_percent != null) {
            // Note: Different strength match saving% in MD reports may show 0% if they represent different pack ratios
            // so we compare only when saving% is significant.
            if (Math.abs(mdRec.savings) > 0.01 && Math.abs(match.savings_percent) > 0.01) {
              assertClose(mdRec.savings, match.savings_percent, `${mdRec.brand} savings`);
            }
          }
        }
      });
    });
  });
});
