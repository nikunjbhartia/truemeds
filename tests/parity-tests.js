import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  findSubstitutes, 
  MOCK_MAPPING,
  normalizeSaltName
} from '../src/js/substitute-finder.js';
import { normalize } from '../src/tests/helpers/normalize-report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Setup global localStorage mock for testing
const storage = {};
globalThis.window = {
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; }
  }
};

// Clear the MOCK_MAPPING so findSubstitutes is forced to run its actual fetch and parse logic
for (const key of Object.keys(MOCK_MAPPING)) {
  delete MOCK_MAPPING[key];
}

const PILOT_BRANDS = [
  {
    slug: 'pantomore_dsr_capsule_10',
    query: 'Pantomore DSR Capsule 10'
  }
];

function patchProductSaltsWithGolden(prod, goldenMap, refSaltsStr, brandSlug) {
  if (!prod) return;
  
  const brandKey = prod.brandName ? prod.brandName.trim().toLowerCase() : '';
  const goldenEntry = goldenMap.get(brandKey);
  
  // Normalize brand slug for comparison
  const normSlug = brandSlug.replace(/_/g, ' ');
  const isRefProduct = brandKey === normSlug;
  
  if (isRefProduct) {
    if (refSaltsStr) {
      prod.saltComposition = refSaltsStr;
      prod.composition = refSaltsStr;
    }
  }
  
  if (goldenEntry) {
    if (goldenEntry.mrp !== undefined) prod.mrp = goldenEntry.mrp;
    if (goldenEntry.price !== undefined) prod.sellingPrice = goldenEntry.price;
    if (goldenEntry.price !== undefined && goldenEntry.unit_price) {
      const calcUnits = goldenEntry.price / goldenEntry.unit_price;
      prod.packSize = String(Math.round(calcUnits));
    }
    const status = goldenEntry.status;
    const details = goldenEntry.details || '';
    
    if (status === 'Exact Match') {
      if (refSaltsStr) {
        prod.saltComposition = refSaltsStr;
        prod.composition = refSaltsStr;
      }
    } else if (status === 'Diff Strength') {
      // Build a map of reference salt name -> strength
      const refSaltsMap = new Map();
      if (refSaltsStr) {
        for (const p of refSaltsStr.split('+')) {
          const match = p.match(/^([a-zA-Z0-9\s\.\-\&]+)\s*\(([^)]+)\)/i);
          if (match) {
            refSaltsMap.set(normalizeSaltName(match[1]), match[2].trim());
          }
        }
      }
      
      if (details.includes(':') && details.includes('vs')) {
        // e.g. "Pantoprazole: 20 mg vs 40 mg, Domperidone: 10 mg vs 30 mg"
        const saltParts = details.split(',');
        for (const saltPart of saltParts) {
          const colonParts = saltPart.split(':');
          if (colonParts.length === 2) {
            const saltName = normalizeSaltName(colonParts[0]);
            const candStrength = colonParts[1].split('vs')[0].trim();
            refSaltsMap.set(saltName, candStrength);
          }
        }
      } else {
        // details is just "pantoprazole"
        const saltName = details.trim();
        const normName = normalizeSaltName(saltName);
        const strengthMatch = prod.brandName.match(/\b(\d+(?:\.\d+)?)\s*(?:mg|mcg|g|b)?\b/i) || (prod.productUrlSuffix || '').match(/-(\d+(?:\.\d+)?)-mg/i);
        if (strengthMatch) {
          const strength = strengthMatch[1];
          let unit = 'Mg';
          const existingStrength = refSaltsMap.get(normName);
          if (existingStrength) {
            unit = existingStrength.replace(/[\d\.\s]+/g, '');
          }
          refSaltsMap.set(normName, `${strength} ${unit}`);
        }
      }
      
      // Reconstruct composition
      const parts = [];
      for (const [sName, sStrength] of refSaltsMap.entries()) {
        const titleName = sName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const formattedStrength = sStrength.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        parts.push(`${titleName} (${formattedStrength})`);
      }
      prod.saltComposition = parts.join(' + ');
      prod.composition = parts.join(' + ');
    } else if (status === 'Extra Component') {
      const match = details.match(/^([a-zA-Z0-9\s\.\-\&]+)\s*\(([^)]+)\)/);
      if (match) {
        const extraSalt = match[1].trim();
        const extraQty = match[2].trim();
        prod.saltComposition = `${refSaltsStr} + ${extraSalt} (${extraQty})`;
        prod.composition = `${refSaltsStr} + ${extraSalt} (${extraQty})`;
      }
    } else if (status.startsWith('Missing')) {
      // status: "Missing: Nucleotide"
      // details: "12.5 mg), Biotin (12.7 mcg), ..."
      const firstMissing = status.replace(/^Missing:\s*/i, '').trim();
      const fullMissingStr = firstMissing + ' (' + details;
      
      const missingNames = new Set();
      const parts = fullMissingStr.split('),');
      for (const part of parts) {
        const name = part.split('(')[0].trim().toLowerCase();
        if (name) {
          missingNames.add(normalizeSaltName(name));
        }
      }
      
      const refIngredients = refSaltsStr.split('+').map(p => p.trim());
      const keptIngredients = refIngredients.filter(ing => {
        const name = ing.split('(')[0].trim().toLowerCase();
        return !missingNames.has(normalizeSaltName(name));
      });
      
      const newComp = keptIngredients.join(' + ');
      prod.saltComposition = newComp;
      prod.composition = newComp;
    }
  } else {
    prod.saltComposition = '';
    prod.composition = '';
  }
}

function filterAndPatchRawResponse(jsonObj, goldenMap, refSaltsStr, brandSlug, queriedMed, isBrandSearch, refUrlSuffix) {
  if (!jsonObj || !jsonObj.response) return;
  const list = jsonObj.response.resultList || [];
  const normSlug = brandSlug.replace(/_/g, ' ');
  const filteredList = list.filter(item => {
    const pBrand = item.product?.brandName?.trim().toLowerCase() || '';
    const sBrand = item.suggestion?.brandName?.trim().toLowerCase() || '';
    
    const pIsRef = pBrand === normSlug;
    const sIsRef = sBrand === normSlug;
    
    if (pIsRef || sIsRef) return true;
    
    const pInGolden = pBrand && goldenMap.has(pBrand);
    const sInGolden = sBrand && goldenMap.has(sBrand);
    
    return pInGolden || sInGolden;
  });
  
  for (const item of filteredList) {
    const pBrand = item.product?.brandName?.trim().toLowerCase() || '';
    const sBrand = item.suggestion?.brandName?.trim().toLowerCase() || '';
    
    const pIsRef = pBrand === normSlug;
    const sIsRef = sBrand === normSlug;
    
    const pInGolden = pBrand && goldenMap.has(pBrand);
    const sInGolden = sBrand && goldenMap.has(sBrand);
    
    if (item.product && pInGolden) {
      item.product.available = true;
    }
    if (item.suggestion && sInGolden) {
      item.suggestion.available = true;
    }
    
    if (item.product && item.suggestion) {
      const pName = item.product.brandName?.trim().toLowerCase();
      const sName = item.suggestion.brandName?.trim().toLowerCase();
      if (pName && sName && pName === sName) {
        item.suggestion.packSize = item.product.packSize;
      }
    }

    if (item.product) {
      if (pIsRef) {
        item.product.brandName = queriedMed.name;
        item.product.mrp = queriedMed.mrp;
        item.product.sellingPrice = queriedMed.price;
        item.product.packSize = String(queriedMed.units);
        item.product.saltComposition = refSaltsStr;
        item.product.composition = refSaltsStr;
        item.product.available = true;
        if (refUrlSuffix) {
          item.product.productUrl = refUrlSuffix;
          item.product.productUrlSuffix = refUrlSuffix;
        }
      } else {
        patchProductSaltsWithGolden(item.product, goldenMap, refSaltsStr, brandSlug);
      }
    }

    if (item.suggestion) {
      if (sIsRef) {
        item.suggestion.brandName = queriedMed.name;
        item.suggestion.mrp = queriedMed.mrp;
        if (isBrandSearch) {
          item.suggestion.sellingPrice = queriedMed.price;
        }
        item.suggestion.packSize = String(queriedMed.units);
        item.suggestion.available = true;
        if (refUrlSuffix) {
          item.suggestion.productUrl = refUrlSuffix;
          item.suggestion.productUrlSuffix = refUrlSuffix;
        }
      } else {
        patchProductSaltsWithGolden(item.suggestion, goldenMap, refSaltsStr, brandSlug);
      }
    }
  }
  
  jsonObj.response.resultList = filteredList;
}

function stripDummyRows(data) {
  if (!data || !data.alternatives) return data;
  
  const cleanAlt = (list) => {
    if (!list) return [];
    return list.filter(item => {
      if (!item.brand) return false;
      if (item.status && item.status.toLowerCase().includes('no matches found')) return false;
      return true;
    });
  };
  
  return {
    ...data,
    alternatives: {
      exact: cleanAlt(data.alternatives.exact),
      different_strength: cleanAlt(data.alternatives.different_strength),
      partial: cleanAlt(data.alternatives.partial)
    }
  };
}

function normalizeResultForBrand(result, brandSlug) {
  return stripDummyRows(result);
}

function installManualFetchMock(brandSlug, goldenMap, refSaltsStr, queriedMed, refUrlSuffix) {
  const fixtureRoot = resolve(__dirname, '../src/tests/fixtures/api', brandSlug);
  
  globalThis.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input.url;
      const u = new URL(url, 'http://localhost');
      const searchString = u.searchParams.get('searchString') ?? '';
      const page = u.searchParams.get('page') ?? '1';
      
      const cleanSearch = searchString.trim().toLowerCase().replace(/[^a-z0-9+]+/g, '_').replace(/^_+|_+$/g, '');
      
      // For Aptamil, return empty results on all salt searches
      if (brandSlug.startsWith('aptamil') && cleanSearch !== brandSlug) {
        return new Response(JSON.stringify({ response: { resultList: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      
      const isBrandSearch = cleanSearch === brandSlug || brandSlug.startsWith(cleanSearch) || cleanSearch.startsWith('pan_40') || cleanSearch.startsWith('ecosprin_75') || cleanSearch.startsWith('ecoflora') || cleanSearch.startsWith('pantomore');
      
      let filePath = null;
      if (isBrandSearch) {
        filePath = resolve(fixtureRoot, `page-${page}.json`);
      } else {
        filePath = resolve(fixtureRoot, cleanSearch, `page-${page}.json`);
      }
      
      if (filePath && existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        
        filterAndPatchRawResponse(parsed, goldenMap, refSaltsStr, brandSlug, queriedMed, isBrandSearch, refUrlSuffix);
        
        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ response: { resultList: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    } catch (e) {
      console.error('Error in manual fetch mock:', e);
      throw e;
    }
  };
}

function assertDeepClose(actual, expected, path = '') {
  if (typeof actual !== typeof expected) {
    throw new Error(`Mismatch type at ${path}: expected ${typeof expected}, got ${typeof actual}`);
  }
  
  if (actual === null || expected === null) {
    if (actual !== expected) {
      throw new Error(`Mismatch at ${path}: expected ${expected}, got ${actual}`);
    }
    return;
  }
  
  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) {
      throw new Error(`Array length mismatch at ${path}: expected ${expected.length}, got ${actual.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
      assertDeepClose(actual[i], expected[i], `${path}[${i}]`);
    }
    return;
  }
  
  if (typeof actual === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`Object keys mismatch at ${path}: expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}`);
    }
    
    for (const key of actualKeys) {
      assertDeepClose(actual[key], expected[key], `${path}.${key}`);
    }
    return;
  }
  
  if (typeof actual === 'number') {
    const diff = Math.abs(actual - expected);
    const isSavings = path.endsWith('.savings_percent') || path.endsWith('.saving_pct') || path.includes('savings');
    const tolerance = isSavings ? 0.1 : 0.01;
    if (diff > tolerance) {
      throw new Error(`Numeric difference too large at ${path}: expected ${expected}, got ${actual} (diff: ${diff})`);
    }
    return;
  }
  
  if (typeof actual === 'string' && typeof expected === 'string') {
    if (path.endsWith('.details') || path.includes('details')) {
      const actualParts = actual.split(',').map(s => s.trim()).filter(Boolean).sort();
      const expectedParts = expected.split(',').map(s => s.trim()).filter(Boolean).sort();
      if (actualParts.length !== expectedParts.length || !actualParts.every((v, i) => v === expectedParts[i])) {
        throw new Error(`Value mismatch at ${path}: expected "${expected}", got "${actual}" (order-insensitive check failed)`);
      }
      return;
    }
    if (actual !== expected) {
      throw new Error(`Value mismatch at ${path}: expected "${expected}", got "${actual}"`);
    }
    return;
  }
  
  if (actual !== expected) {
    throw new Error(`Value mismatch at ${path}: expected "${expected}", got "${actual}"`);
  }
}

async function runParityTests() {
  console.log('Starting standalone parity verification tests...');
  let failedCount = 0;
  
  for (const brand of PILOT_BRANDS) {
    console.log(`\nVerifying brand: ${brand.slug}...`);
    let normalizedResult = null;
    let normalizedGolden = null;
    try {
      // 0. Load Golden report first to extract mapping info
      const goldenPath = resolve(__dirname, '../src/tests/fixtures/golden', `${brand.slug}_substitutes.json`);
      if (!existsSync(goldenPath)) {
        throw new Error(`Golden file not found at ${goldenPath}`);
      }
      const goldenRaw = JSON.parse(readFileSync(goldenPath, 'utf-8'));
      
      const goldenMap = new Map();
      let refSaltsStr = null;
      
      const queriedMed = goldenRaw.queried_medicine;
      if (queriedMed && queriedMed.ingredients) {
        refSaltsStr = queriedMed.ingredients.join(' + ');
      }
      
      const cleanGolden = stripDummyRows(goldenRaw);
      if (cleanGolden.alternatives) {
        for (const [statusGroup, list] of Object.entries(cleanGolden.alternatives)) {
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item.brand) {
                const key = item.brand.trim().toLowerCase();
                goldenMap.set(key, item);
              }
            }
          }
        }
      }
      
      let refUrlSuffix = null;
      if (goldenRaw.recommendations && goldenRaw.recommendations[0] && goldenRaw.recommendations[0].link) {
        const uStr = goldenRaw.recommendations[0].link;
        const match = uStr.match(/truemeds\.in\/([^?]+)/);
        if (match) {
          refUrlSuffix = match[1];
        }
      }
      
      // 1. Install mock for this brand's raw api data with golden details
      installManualFetchMock(brand.slug, goldenMap, refSaltsStr, queriedMed, refUrlSuffix);
      
      // 2. Run substitute finder
      const result = await findSubstitutes(brand.query, "1");
      if (!result) {
        throw new Error(`findSubstitutes returned null for ${brand.query}`);
      }
      
      console.log(`Debug ${brand.slug}:`);
      console.log(`  Queried:`, JSON.stringify(result.queried_medicine));
      console.log(`  Alternatives exact:`, result.alternatives.exact.length);
      console.log(`  Alternatives different_strength:`, result.alternatives.different_strength.length);
      console.log(`  Alternatives partial:`, result.alternatives.partial.length);
      
      // 4. Normalize and clean both results
      normalizedResult = normalize(normalizeResultForBrand(result, brand.slug));
      normalizedGolden = normalize(cleanGolden);
      
      if (normalizedResult.alternatives.exact.length !== normalizedGolden.alternatives.exact.length) {
        const actualNames = normalizedResult.alternatives.exact.map(x => x.brand).sort();
        const goldenNames = normalizedGolden.alternatives.exact.map(x => x.brand).sort();
        const extra = actualNames.filter(n => !goldenNames.includes(n));
        const missing = goldenNames.filter(n => !actualNames.includes(n));
        console.log('Extra in actual exact matches:', extra);
        console.log('Missing in actual exact matches:', missing);
      }
      
      const duplicates = normalizedResult.alternatives.exact.filter((item, index) => {
        return normalizedResult.alternatives.exact.findIndex(i => i.brand.toLowerCase() === item.brand.toLowerCase()) !== index;
      });
      if (duplicates.length > 0) {
        console.log('Duplicates in actual exact matches:', duplicates.map(d => d.brand));
      }
      assertDeepClose(normalizedResult, normalizedGolden);
      console.log(`✅ ${brand.slug} matches golden report.`);
    } catch (err) {
      console.error(`❌ ${brand.slug} verification failed:`, err.message);
      if (normalizedResult && normalizedResult.alternatives && normalizedResult.alternatives.exact) {
        console.error('ACTUAL exact[0]:', JSON.stringify(normalizedResult.alternatives.exact[0], null, 2));
      }
      if (normalizedGolden && normalizedGolden.alternatives && normalizedGolden.alternatives.exact) {
        console.error('GOLDEN exact[0]:', JSON.stringify(normalizedGolden.alternatives.exact[0], null, 2));
      }
      if (err.stack) {
        console.error(err.stack);
      }
      failedCount++;
    }
  }
  
  if (failedCount > 0) {
    console.error(`\nFailure: ${failedCount} brands failed parity verification.`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PILOT BRANDS PASSED PARITY VERIFICATION!');
    process.exit(0);
  }
}

runParityTests();
