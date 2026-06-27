// src/tests/update-golden.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSubstitutes } from '../js/substitute-finder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const API_FIXTURE_DIR = path.resolve(REPO_ROOT, 'src/tests/fixtures/api');
const GOLDEN_DIR = path.resolve(REPO_ROOT, 'src/tests/fixtures/golden');

// Mock global fetch to load mock API fixtures from the file system
globalThis.fetch = async (url) => {
  const u = new URL(url);
  const searchString = u.searchParams.get('searchString') || '';
  const page = u.searchParams.get('page') || '1';
  const searchSlug = searchString.trim().toLowerCase().replace(/[^a-z0-9+]+/g, '_').replace(/^_+|_+$/g, '');

  const possiblePaths = [
    path.join(API_FIXTURE_DIR, process.env.MOCK_FIXTURE_DIR || '', searchSlug, `page-${page}.json`),
    path.join(API_FIXTURE_DIR, process.env.MOCK_FIXTURE_DIR || '', `page-${page}.json`),
    path.join(API_FIXTURE_DIR, searchSlug, `page-${page}.json`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => JSON.parse(data),
        text: async () => data
      };
    }
  }

  if (page !== '1') {
    return {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ responseData: { elasticProductDetails: [] }, response: { resultList: [] } }),
      text: async () => JSON.stringify({ response: { resultList: [] } })
    };
  }

  throw new Error(`Mock fetch file not found for searchString="${searchString}" page="${page}". Tried paths: ${possiblePaths.join(', ')}`);
};

const testCases = [
  {
    slug: 'ecosprin_75_tablet_14',
    apiFolder: 'ecosprin_75_tablet_14',
    goldenFile: 'ecosprin_75_tablet_14_substitutes.json',
    query: 'Ecosprin 75'
  },
  {
    slug: 'pan_40_tablet_15',
    apiFolder: 'pan_40_tablet_15',
    goldenFile: 'pan_40_tablet_15_substitutes.json',
    query: 'Pan 40'
  },
  {
    slug: 'ecoflora_capsule_30',
    apiFolder: 'ecoflora_capsule_30',
    goldenFile: 'ecoflora_capsule_30_substitutes.json',
    query: 'Ecoflora Capsule'
  },
  {
    slug: 'pantomore_dsr_capsule_10',
    apiFolder: 'pantomore_dsr_capsule_10',
    goldenFile: 'pantomore_dsr_capsule_10_substitutes.json',
    query: 'Pantomore Dsr'
  },
  {
    slug: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm',
    apiFolder: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm',
    goldenFile: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm_substitutes.json',
    query: 'Aptamil Premium Stage 1'
  }
];

async function update() {
  for (const tc of testCases) {
    const apiPath = path.join(API_FIXTURE_DIR, tc.apiFolder, 'page-1.json');
    if (!fs.existsSync(apiPath)) {
      console.error(`API fixture not found at: ${apiPath}`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(apiPath, 'utf-8'));
    const resultsList = rawData.responseData?.elasticProductDetails || rawData.response?.resultList || [];

    // Setup mock environment variables so substitute-finder loadMockData returns the local fixture files if needed
    process.env.MOCK_FIXTURE_DIR = tc.apiFolder;
    process.env.SKIP_MOCK_SHORTCUT = '1';

    const result = await findSubstitutes(tc.query, '1');
    
    if (result) {
      const outputPath = path.join(GOLDEN_DIR, tc.goldenFile);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`Updated golden file: ${tc.goldenFile}`);
    } else {
      console.error(`Failed to process: ${tc.query}`);
    }
  }
  console.log('Update complete!');
}

update();
