import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect } from 'vitest';
import { findSubstitutes } from '../js/substitute-finder.js';
import { installFetchMockFromDir } from './helpers/mock-fetch.js';
import { extractAlternativeRows } from './helpers/parity-md-parser.js';
import { canonicalStatus } from './helpers/parity-md-parser.js';

describe('debug diff', () => {
  test('compare', async () => {
    const REPO_ROOT = process.cwd();
    const fixtureDir = 'ecoflora_capsule_30';
    const FIXTURE_API_ROOT = path.resolve(REPO_ROOT, 'src', 'tests', 'fixtures', 'api');
    installFetchMockFromDir(fixtureDir);

    const mdPath = path.join(REPO_ROOT, 'python', 'reports', 'ecoflora_capsule_30_substitutes.md');
    if (!fs.existsSync(mdPath)) {
      console.error("Markdown file does not exist, run parity test first to generate it.");
      return;
    }
    const markdown = fs.readFileSync(mdPath, 'utf-8');
    const pythonRecords = extractAlternativeRows(markdown);

    function altGroup(out, ...keys) {
      for (const k of keys) {
        const v = out?.alternatives?.[k];
        if (Array.isArray(v)) return v;
      }
      return [];
    }

    function jsRowToRecord(item, fallbackStatus) {
      const rawStatus = item.status || fallbackStatus;
      const fullStatus = item.details ? `${rawStatus} (${item.details})` : rawStatus;
      const canonical = canonicalStatus(fullStatus);

      return {
        status:       canonical.status,
        details:      canonical.details || '',
        brand:        String(item.brand ?? item.name ?? '').trim(),
        manufacturer: String(item.manufacturer ?? '').trim(),
        pack_form:    String(item.pack_form ?? '').trim(),
        pack_mrp:     item.mrp             != null ? Number(item.mrp)             : null,
        pack_price:   item.price           != null ? Number(item.price)           : null,
        unit_price:   item.unit_price      != null ? Number(item.unit_price)      : null,
        savings_pct:  item.savings_percent != null ? Number(item.savings_percent) : null,
      };
    }

    function projectEngineOutput(out) {
      const records = [];
      for (const it of altGroup(out, 'exact'))
        records.push(jsRowToRecord(it, 'Exact Match'));
      for (const it of altGroup(out, 'different_strength', 'diff_strength'))
        records.push(jsRowToRecord(it, 'Diff Strength'));
      for (const it of altGroup(out, 'partial', 'extra', 'missing')) {
        const guess = it.status || (it.details?.startsWith('Missing') ? 'Missing' : 'Extra Component');
        records.push(jsRowToRecord(it, guess));
      }
      return records;
    }

    const jsOutput = await findSubstitutes('Ecoflora Capsule __PARITY__');
    const jsRecords = projectEngineOutput(jsOutput);

    const fixturePath = path.resolve(REPO_ROOT, 'src/tests/fixtures/api/ecoflora_capsule_30/probiotic_microbes/page-1.json');
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const { parseMedicineInfo } = await import('../js/substitute-finder.js');

    const candidates = {};
    const targetCode = 'tm-saet1-000306';

    for (const item of fixtureData.response.resultList) {
      const prod = item.product;
      const sugg = item.suggestion;

      if (sugg) {
        const sInfo = parseMedicineInfo(sugg);
        if (prod) {
          const parentInfo = parseMedicineInfo(prod);
          sInfo.salts = parentInfo.salts;
          sInfo.composition = parentInfo.composition;
          sInfo.parent_name = parentInfo.name;
          sInfo.parent_url = parentInfo.product_url;
          sInfo.is_suggestion = true;
        } else {
          sInfo.is_suggestion = false;
        }
        if (sInfo.code === targetCode) {
          console.log('\nProcessing suggestion for target code:', sInfo);
        }
        if (sInfo.available) {
          const existing = candidates[sInfo.code];
          if (!existing || sInfo.price_per_unit < existing.price_per_unit) {
            candidates[sInfo.code] = sInfo;
            if (sInfo.code === targetCode) {
              console.log('Stored suggestion in candidates map. Candidates state:', candidates[targetCode]);
            }
          }
        }
      }

      if (prod) {
        const pInfo = parseMedicineInfo(prod);
        pInfo.is_suggestion = false;
        if (pInfo.code === targetCode) {
          console.log('\nProcessing product for target code:', pInfo);
        }
        if (pInfo.available) {
          const existing = candidates[pInfo.code];
          if (!existing || pInfo.price_per_unit < existing.price_per_unit) {
            candidates[pInfo.code] = pInfo;
            if (pInfo.code === targetCode) {
              console.log('Stored product in candidates map. Candidates state:', candidates[targetCode]);
            }
          } else {
            if (pInfo.code === targetCode) {
              console.log('Product NOT stored (existing price_per_unit is lower/same). Existing:', existing.price_per_unit, 'New:', pInfo.price_per_unit);
            }
          }
        }
      }
    }
  });
});
