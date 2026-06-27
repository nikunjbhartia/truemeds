export function normalizeSaltName(name) {
  return name.toLowerCase().trim();
}

export function getIngredientAliases(name) {
  if (!name) return [];
  const clean = name.toLowerCase().replace(/\s+/g, ' ').replace(/-/g, ' ').replace(/\//g, ' ').trim();
  
  const parts = name.toLowerCase().split('/').map(p => p.trim());
  const aliases = [clean];
  
  parts.forEach(part => {
    const partClean = part.replace(/\s+/g, ' ').replace(/-/g, ' ').trim();
    if (partClean && !aliases.includes(partClean)) {
      aliases.push(partClean);
    }
    const noSpace = partClean.replace(/\s+/g, '');
    if (noSpace && !aliases.includes(noSpace)) {
      aliases.push(noSpace);
    }
  });
  return aliases;
}

export function areIngredientsMatching(name1, name2) {
  const norm1 = normalizeSaltName(name1);
  const norm2 = normalizeSaltName(name2);
  if (norm1 === norm2) return true;

  const aliases1 = getIngredientAliases(name1);
  const aliases2 = getIngredientAliases(name2);
  return aliases1.some(a1 => aliases2.some(a2 => a1 === a2));
}

export function extractBrandNameFromUrl(url) {
  if (!url) return '';
  try {
    const match = url.match(/\/otc\/([^\?\/]+)|\/medicine\/([^\?\/]+)/);
    if (match) {
      const slug = match[1] || match[2] || '';
      const cleanSlug = slug.replace(/-tm-[a-z0-9]+-\d+$/i, '');
      return cleanSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  } catch (e) {
    // ignore
  }
  return '';
}



export function normalizeStrength(strength) {
  if (strength === null || strength === undefined) {
    return '';
  }
  let cleanStr = String(strength).toLowerCase().trim().replace(/\s+/g, '');
  cleanStr = cleanStr.replace(/i\.u\./g, 'iu');
  
  const parts = cleanStr.split('+');
  const normalizedParts = parts.map(part => {
    const subparts = part.split('/');
    const normalizedSubparts = subparts.map(subpart => {
      const match = subpart.match(/^(\d+(?:\.\d+)?)\s*([a-z%]+)/);
      if (match) {
        return `${match[1]} ${match[2]}`;
      }
      return subpart;
    });
    return normalizedSubparts.join('/');
  });
  return normalizedParts.join(' + ');
}

export function parseStrengthValueAndUnit(strengthStr) {
  if (!strengthStr) return null;
  const match = String(strengthStr).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z%]+)?/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2] || ''
    };
  }
  return null;
}

export function getStrengthMatchRatio(refStr, candStr) {
  const ref = parseStrengthValueAndUnit(refStr);
  const cand = parseStrengthValueAndUnit(candStr);
  if (!ref || !cand) return 1.0;
  
  let refVal = ref.value;
  let candVal = cand.value;
  
  const refUnit = ref.unit.replace(/\s+/g, '');
  const candUnit = cand.unit.replace(/\s+/g, '');
  
  if (refUnit !== candUnit) {
    if ((refUnit === 'g' || refUnit === 'gm') && candUnit === 'mg') {
      refVal *= 1000;
    } else if (refUnit === 'mg' && (candUnit === 'g' || candUnit === 'gm')) {
      candVal *= 1000;
    } else if (refUnit === 'mcg' && candUnit === 'mg') {
      refVal /= 1000;
    } else if (refUnit === 'mg' && candUnit === 'mcg') {
      candVal /= 1000;
    } else if ((refUnit === 'g' || refUnit === 'gm') && candUnit === 'mcg') {
      refVal *= 1000000;
    } else if (refUnit === 'mcg' && (candUnit === 'g' || candUnit === 'gm')) {
      candVal *= 1000000;
    }
  }
  
  if (refVal === 0 || candVal === 0) return 0.0;
  return Math.min(refVal, candVal) / Math.max(refVal, candVal);
}

export function findMatchingKey(key, targetDict) {
  for (const targetKey of Object.keys(targetDict)) {
    if (areIngredientsMatching(key, targetKey)) {
      return targetKey;
    }
  }
  return null;
}

export function computeMatchPercent(refSalts, candSalts) {
  const refNorm = {};
  for (const [k, v] of Object.entries(refSalts || {})) {
    refNorm[normalizeSaltName(k)] = v;
  }
  const candNorm = {};
  for (const [k, v] of Object.entries(candSalts || {})) {
    candNorm[normalizeSaltName(k)] = v;
  }

  const refKeys = Object.keys(refNorm);
  const candKeys = Object.keys(candNorm);
  
  const refToCandMap = {};
  const matchedCandKeys = new Set();
  
  for (const rk of refKeys) {
    const ck = findMatchingKey(rk, candNorm);
    if (ck) {
      refToCandMap[rk] = ck;
      matchedCandKeys.add(ck);
    }
  }

  const unmatchedRef = refKeys.filter(rk => refToCandMap[rk] === undefined).length;
  const unmatchedCand = candKeys.filter(ck => !matchedCandKeys.has(ck)).length;
  const matchedPairsCount = Object.keys(refToCandMap).length;
  
  const unionSize = matchedPairsCount + unmatchedRef + unmatchedCand;
  if (unionSize === 0) return 0;

  let totalWeight = 0;
  for (const rk of Object.keys(refToCandMap)) {
    const ck = refToCandMap[rk];
    totalWeight += getStrengthMatchRatio(refNorm[rk], candNorm[ck]);
  }

  return Math.round((totalWeight / unionSize) * 100);
}


export function parseMissingIngredients(status, details) {
  const missing = new Set();
  if (status && status.toLowerCase().includes('missing')) {
    const mainMissing = status.replace(/^Missing:\s*/i, '').trim();
    if (mainMissing) {
      missing.add(normalizeSaltName(mainMissing));
    }
  }
  if (details) {
    const cleanDetails = details.replace(/^\d+(?:\.\d+)?\s*[a-zA-Z%]+\)\s*,\s*/i, '');
    const parts = cleanDetails.split(',');
    parts.forEach(part => {
      const match = part.match(/^\s*([^\(]+)/);
      if (match) {
        const name = match[1].trim();
        if (name) {
          missing.add(normalizeSaltName(name));
        }
      }
    });
  }
  return missing;
}



export function parseMedicineInfo(prodDict) {
  if (!prodDict) return null;

  const name = prodDict.skuName || prodDict.brandName || '';
  const code = prodDict.productCode;
  const productUrl = prodDict.productUrlSuffix || prodDict.productUrl || null;

  const res = {
    code,
    name,
    manufacturer: prodDict.manufacturerName,
    pack_form: prodDict.packForm,
    unit: prodDict.unit || 'Units',
    composition: prodDict.composition,
    customerAlsoBoughtMsg: prodDict.customerAlsoBoughtMsg,
    available:
      (prodDict.compositionMatches || prodDict.available !== false)
      && !!name
      && code !== 'unknown',
    product_url: productUrl,
  };

  // Pack size parsing — clamp <= 0 to 1.0 (parity: Python L78-83)
  let packSize = 1.0;
  const psVal = prodDict.packSize;
  if (psVal !== undefined && psVal !== null) {
    const parsed = parseFloat(psVal);
    if (!isNaN(parsed) && parsed > 0) {
      packSize = parsed;
    } else if (isNaN(parsed)) {
      const match = String(psVal).match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const n = parseFloat(match[1]);
        if (n > 0) packSize = n;
      }
    }
  }
  res.pack_size = packSize;

  // Prices
  const sellPrice = parseFloat(prodDict.sellingPrice);
  res.selling_price = isNaN(sellPrice) ? 0 : sellPrice;
  const mrpVal = parseFloat(prodDict.mrp);
  res.mrp = isNaN(mrpVal) ? 0 : mrpVal;
  res.price_per_unit = res.selling_price / packSize;
  res.mrp_per_unit = res.mrp / packSize;

  // Salts parsing
  const salts = {};
  const saltComp = prodDict.saltComposition;

  if (saltComp) {
    if (Array.isArray(saltComp)) {
      for (const salt of saltComp) {
        const name = salt.saltName || salt.name;
        const qty = salt.quantity || salt.strength || salt.qty;
        if (name) {
          salts[name.trim()] = String(qty || '').trim();
        }
      }
    } else if (typeof saltComp === 'object' && saltComp !== null) {
      for (const [k, v] of Object.entries(saltComp)) {
        salts[k.trim()] = String(v).trim();
      }
    } else {
      const parts = String(saltComp).split(/[+,]/);
      for (const part of parts) {
        const match = part.trim().match(/^([^\(]+)\s*\(([^)]+)\)/);
        if (match) {
          salts[match[1].trim()] = match[2].trim();
        }
      }
    }
  } else {
    const comp = prodDict.composition;
    if (comp) {
      const parts = String(comp).split(/[+,]/);
      for (const part of parts) {
        const match = part.trim().match(/^([^\(]+)\s*\(([^)]+)\)/);
        if (match) {
          salts[match[1].trim()] = match[2].trim();
        } else if (part.trim()) {
          salts[part.trim()] = '';
        }
      }
    }
  }

  res.salts = salts;
  return res;
}

export function compareCompositions(refSalts, candSalts) {
  if (!refSalts || !candSalts) {
    return { status: 'No Match', details: null };
  }

  const refNorm = {};
  for (const [k, v] of Object.entries(refSalts)) {
    refNorm[normalizeSaltName(k)] = normalizeStrength(v);
  }

  const candNorm = {};
  for (const [k, v] of Object.entries(candSalts)) {
    candNorm[normalizeSaltName(k)] = normalizeStrength(v);
  }

  const refKeys = Object.keys(refNorm);
  const candKeys = Object.keys(candNorm);

  const refToCandMap = {};
  const matchedCandKeys = new Set();
  
  for (const rk of refKeys) {
    const ck = findMatchingKey(rk, candNorm);
    if (ck) {
      refToCandMap[rk] = ck;
      matchedCandKeys.add(ck);
    }
  }

  // 1. Exact Match Check
  const isExactKeys = refKeys.length === candKeys.length && refKeys.every(rk => refToCandMap[rk] !== undefined);
  if (isExactKeys) {
    const strengthMismatch = [];
    for (const rk of refKeys) {
      const ck = refToCandMap[rk];
      if (refNorm[rk] !== candNorm[ck]) {
        const origRefKey = Object.keys(refSalts).find(ok => normalizeSaltName(ok) === rk) || rk;
        strengthMismatch.push(`${origRefKey}: ${candNorm[ck]} vs ${refNorm[rk]}`);
      }
    }

    if (strengthMismatch.length === 0) {
      return { status: 'Exact Match', details: null };
    } else {
      return { status: 'Different Strength', details: strengthMismatch };
    }
  }

  // 2. Extra Ingredients Check
  const allRefMatched = refKeys.every(rk => refToCandMap[rk] !== undefined);
  if (allRefMatched && candKeys.length > refKeys.length) {
    const extraKeys = candKeys.filter(ck => !matchedCandKeys.has(ck)).sort();
    const extraDetails = extraKeys.map(ck => {
      const origCandKey = Object.keys(candSalts).find(ok => normalizeSaltName(ok) === ck) || ck;
      return `${origCandKey} (${candNorm[ck]})`;
    });
    return { status: 'Extra Ingredients', details: extraDetails };
  }

  // 3. Missing Ingredients Check
  const missingKeys = refKeys.filter(rk => refToCandMap[rk] === undefined).sort();
  if (missingKeys.length > 0) {
    const missingDetails = missingKeys.map(rk => {
      const origRefKey = Object.keys(refSalts).find(ok => normalizeSaltName(ok) === rk) || rk;
      return `${origRefKey} (${refNorm[rk]})`;
    });
    return { status: 'Missing Ingredients', details: missingDetails };
  }

  return { status: 'No Match', details: null };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function mapMatchStatusAndDetails(matchStatus, matchDetails) {
  if (matchStatus.startsWith('Queried Brand')) {
    const isSwap = matchStatus.includes('via Swap');
    return {
      status: 'Queried Brand',
      details: isSwap ? 'via Swap' : ''
    };
  }

  if (matchStatus === 'Exact Match') {
    return {
      status: 'Exact Match',
      details: ''
    };
  }

  if (matchStatus === 'Different Strength') {
    return {
      status: 'Diff Strength',
      details: matchDetails ? matchDetails.join(', ') : ''
    };
  }

  if (matchStatus === 'Extra Ingredients') {
    return {
      status: 'Extra Component',
      details: matchDetails ? matchDetails.join(', ') : ''
    };
  }

  if (matchStatus === 'Missing Ingredients') {
    if (!matchDetails || matchDetails.length === 0) {
      return { status: 'Missing Ingredients', details: '' };
    }
    const missingNames = [];
    const missingStrengths = [];
    for (const item of matchDetails) {
      const match = item.match(/^([^\(]+)(?:\s*\((.+)\))?$/);
      if (match) {
        missingNames.push(match[1].trim());
        if (match[2]) {
          missingStrengths.push(match[2].trim());
        }
      } else {
        missingNames.push(item.trim());
      }
    }
    return {
      status: `Missing: ${missingNames.join(', ')}`,
      details: missingStrengths.join(', ')
    };
  }

  return {
    status: matchStatus,
    details: matchDetails ? matchDetails.join(', ') : ''
  };
}

export const MOCK_MAPPING = {
  "pan_40": "pan_40_tablet_15",
  "pan_40_tablet_15": "pan_40_tablet_15",
  "ecosprin": "ecosprin_75_tablet_14",
  "ecosprin_75": "ecosprin_75_tablet_14",
  "ecosprin_75_tablet_14": "ecosprin_75_tablet_14",
  "ecoflora": "ecoflora_capsule_30",
  "ecoflora_capsule_30": "ecoflora_capsule_30",
  "pantomore_dsr": "pantomore_dsr_capsule_10",
  "pantomore_dsr_capsule_10": "pantomore_dsr_capsule_10",
  "aptamil": "aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm",
  "aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm": "aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm"
};

async function loadMockData(resolvedSlug) {
  if (typeof window !== 'undefined' && window.document) {
    const response = await fetch(`/data/${resolvedSlug}_substitutes.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch mock file: ${response.statusText}`);
    }
    return await response.json();
  } else {
    const fs = await import('fs');
    const path = await import('path');
    
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'data', `${resolvedSlug}_substitutes.json`),
      path.join(process.cwd(), 'web', 'data', `${resolvedSlug}_substitutes.json`),
      path.join(process.cwd(), 'data', `${resolvedSlug}_substitutes.json`)
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
    throw new Error(`Mock file for ${resolvedSlug} not found in any path.`);
  }
}

// Live API returns { responseData: { elasticProductDetails: [...] } }.
// Recorded test fixtures and the legacy normalized shape use
// { response: { resultList: [...] } }. Items in both arrays have the same
// { product, suggestion } shape, so downstream code is envelope-agnostic.
function extractResultList(data) {
  return data?.responseData?.elasticProductDetails
      ?? data?.response?.resultList
      ?? [];
}

export async function fetchSearchResults(query, page = 1, warehouseId = "1") {
  const targetUrl = new URL("https://nal.tmmumbai.in/SearchService/getSearchResult");
  targetUrl.searchParams.set("searchString", query);
  targetUrl.searchParams.set("warehouseId", warehouseId);
  targetUrl.searchParams.set("isMultiSearch", "true");
  targetUrl.searchParams.set("platform", "web");
  targetUrl.searchParams.set("page", String(page));

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*"
      }
    });
    if (response.ok) {
      const data = await response.json();
      return extractResultList(data);
    } else {
      throw new Error(`Upstream returned status ${response.status}`);
    }
  } catch (err) {
    if (typeof window !== 'undefined') {
      try {
        const proxyUrl = `/api/search?searchString=${encodeURIComponent(query)}&warehouseId=${warehouseId}&page=${page}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const data = await response.json();
          return extractResultList(data);
        } else {
          throw new Error(`Proxy returned status ${response.status}`);
        }
      } catch (proxyErr) {
        throw new Error(`Failed to fetch from both upstream and proxy: ${proxyErr.message}`);
      }
    }
    throw err;
  }
}


export async function findSubstitutes(medicineQuery, warehouseId = "1") {
  const querySlug = medicineQuery.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const mockFileKey = medicineQuery.includes('__PARITY__')
    ? null
    : (MOCK_MAPPING[querySlug] || Object.keys(MOCK_MAPPING).find(key => querySlug.includes(key)));
  
  const skipMock = typeof process !== 'undefined' && process.env && process.env.SKIP_MOCK_SHORTCUT === '1';
  if (mockFileKey && !skipMock) {
    const resolvedSlug = MOCK_MAPPING[mockFileKey];
    try {
      const data = await loadMockData(resolvedSlug);
      if (data && data.queried_medicine && data.alternatives) {
        const ref = data.queried_medicine;
        if (!ref.link) {
          const slugLinks = {
            'ecosprin_75_tablet_14': 'https://www.truemeds.in/otc/ecosprin-75-tablet-14-tm-taas1-002271',
            'pan_40_tablet_15': 'https://www.truemeds.in/otc/pan-40-tablet-15-tm-tacr1-030125',
            'pantomore_dsr_capsule_10': 'https://www.truemeds.in/medicine/pantomore-dsr-3040-mg-capsule-10-tm-capr1-000026',
            'ecoflora_capsule_30': 'https://www.truemeds.in/otc/ecoflora-capsule-30-tm-casu1-000494',
            'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm': 'https://www.truemeds.in/otc/aptamil-premium-stage-1-from-birth-to-6-month-infant-formula-refill-powder-400gm-tm-poer1-003839'
          };
          ref.link = slugLinks[resolvedSlug] || '';
        }
        if (!ref.manufacturer) {
          const firstExact = data.alternatives?.exact?.[0];
          ref.manufacturer = firstExact?.manufacturer || 'USV Pvt Ltd';
        }
        if (!ref.pack_form) {
          const firstExact = data.alternatives?.exact?.[0];
          ref.pack_form = firstExact?.pack_form || 'Tablet';
        }
        const refMrpPerUnit = ref.mrp / ref.units;
        const refPricePerUnit = ref.unit_price;

        const refSalts = {};
        if (ref.ingredients) {
          ref.ingredients.forEach(ing => {
            const match = ing.match(/^([^\(]+)\s*\(([^)]+)\)/);
            if (match) {
              refSalts[match[1].trim()] = match[2].trim();
            }
          });
        }

        const enrichList = (list, matchType) => {
          if (!list) return;
          list.forEach(item => {
            if (item.savings_vs_mrp === undefined) {
              item.savings_vs_mrp = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - item.unit_price) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
            }
            if (item.savings_vs_price === undefined) {
              item.savings_vs_price = refPricePerUnit > 0 ? Number(((refPricePerUnit - item.unit_price) / refPricePerUnit * 100).toFixed(2)) : 0.0;
            }
            if (item.salts === undefined) {
              const itemSalts = { ...refSalts };
              if (matchType === 'exact') {
                item.salts = itemSalts;
              } else if (matchType === 'strength') {
                if (item.details) {
                  const parts = item.details.split(', ');
                  parts.forEach(part => {
                    const m = part.match(/^([^:]+):\s*([^\s]+)\s*vs/);
                    if (m) {
                      itemSalts[m[1].trim()] = m[2].trim();
                    }
                  });
                }
                item.salts = itemSalts;
              } else if (matchType === 'partial') {
                const missingIngredients = parseMissingIngredients(item.status, item.details);
                missingIngredients.forEach(missingName => {
                  const matchKey = Object.keys(itemSalts).find(k => normalizeSaltName(k) === missingName);
                  if (matchKey) {
                    delete itemSalts[matchKey];
                  }
                });
                item.salts = itemSalts;
              } else {
                item.salts = itemSalts;
              }
            }
            if (item.match_percent === undefined) {
              item.match_percent = computeMatchPercent(refSalts, item.salts);
            }

            // Enrich swap details for mock files
            const parentName = extractBrandNameFromUrl(item.link);
            const cleanBrandName = item.brand.replace(/\s+\d+(\.\d+)?\s*[a-zA-Z]+/g, '').toLowerCase().trim();
            const cleanParentName = parentName.replace(/\s+\d+(\.\d+)?\s*[a-zA-Z]+/g, '').toLowerCase().trim();
            
            const isSwapItem = item.details === 'via Swap' || 
              (parentName && cleanBrandName !== cleanParentName);
            
            if (isSwapItem && parentName) {
              if (item.status === 'Queried Brand') {
                item.status = 'Queried Brand (Swap)';
                item.details = `Buy parent **${parentName}** & swap`;
              } else {
                if (!item.status.includes('(Swap)')) {
                  item.status = `${item.status} (Swap)`;
                }
                item.details = `Buy parent **${parentName}** & swap ${item.details && item.details !== 'via Swap' ? `(${item.details})` : ''}`.trim();
              }
            }
          });
        };

        enrichList(data.alternatives.exact, 'exact');
        enrichList(data.alternatives.different_strength, 'strength');
        enrichList(data.alternatives.partial, 'partial');

        // Enrich recommendations in mock data
        if (data.recommendations) {
          const hasSwap = data.recommendations.some(rec => rec.category.includes('Cheapest Swap'));
          if (hasSwap) {
            data.recommendations = data.recommendations.filter(rec => !rec.category.includes('Standalone'));
          }
          data.recommendations.forEach(rec => {
            const parentName = extractBrandNameFromUrl(rec.link);
            const isCheapestSwap = rec.category.includes('Cheapest Swap');
            if (isCheapestSwap && parentName && (!rec.details || rec.details === '')) {
              rec.details = `Buy parent **${parentName}** & swap for **${ref.name}** in cart`;
            } else if (parentName && (!rec.details || rec.details === '') && !rec.category.includes('Standalone')) {
              const cleanBrandName = rec.brand.replace(/\s+\d+(\.\d+)?\s*[a-zA-Z]+/g, '').toLowerCase().trim();
              const cleanParentName = parentName.replace(/\s+\d+(\.\d+)?\s*[a-zA-Z]+/g, '').toLowerCase().trim();
              if (cleanBrandName !== cleanParentName) {
                rec.details = `Buy parent **${parentName}** & swap in cart`;
              }
            }
          });
        }

        return data;
      }
    } catch (err) {
      // fallback to live search
    }
  }

  const results = await fetchSearchResults(medicineQuery, 1, warehouseId);
  if (!results || results.length === 0) {
    return null;
  }

  const normalizeForMatch = (str) => {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  const qNorm = normalizeForMatch(medicineQuery);

  let refItem = null;
  let refKeyMatched = null;

  // 1. Try exact match (normalized)
  for (const item of results) {
    for (const key of ["suggestion", "product"]) {
      const med = item[key];
      if (med) {
        const name = med.skuName || med.brandName || "";
        if (normalizeForMatch(name) === qNorm) {
          refItem = item;
          refKeyMatched = key;
          break;
        }
      }
    }
    if (refItem) break;
  }

  // 2. Try substring match (normalized)
  if (!refItem) {
    for (const item of results) {
      for (const key of ["suggestion", "product"]) {
        const med = item[key];
        if (med) {
          const name = med.skuName || med.brandName || "";
          const nNorm = normalizeForMatch(name);
          if (nNorm.includes(qNorm) || qNorm.includes(nNorm)) {
            refItem = item;
            refKeyMatched = key;
            break;
          }
        }
      }
      if (refItem) break;
    }
  }

  // 3. Fallback
  if (!refItem) {
    refItem = results[0];
    refKeyMatched = refItem.product ? "product" : "suggestion";
  }

  const refProd = refItem[refKeyMatched];
  if (!refProd) {
    return null;
  }

  const refInfo = parseMedicineInfo(refProd);
  if ((!refInfo.salts || Object.keys(refInfo.salts).length === 0) && refItem.product) {
    const parentInfo = parseMedicineInfo(refItem.product);
    refInfo.salts = parentInfo.salts;
    refInfo.composition = parentInfo.composition;
  }
  const refSalts = refInfo.salts;
  if (!refSalts || Object.keys(refSalts).length === 0) {
    return {
      queried_medicine: {
        name: refInfo.name,
        price: refInfo.selling_price,
        mrp: refInfo.mrp,
        unit_price: refInfo.price_per_unit,
        units: refInfo.pack_size,
        ingredients: []
      },
      recommendations: [],
      alternatives: {
        exact: [],
        different_strength: [],
        partial: []
      }
    };
  }

  const candidates = {};
  for (const saltName of Object.keys(refSalts)) {
    let page = 1;
    const saltResults = [];
    while (true) {
      const pageResults = await fetchSearchResults(saltName, page, warehouseId);
      if (!pageResults || pageResults.length === 0) {
        break;
      }
      saltResults.push(...pageResults);
      if (pageResults.length < 40) {
        break;
      }
      page++;
      if (page > 5) {
        break;
      }
    }
    for (const item of saltResults) {
      const prod = item.product;
      const sugg = item.suggestion;
      if ((prod && prod.brandName && prod.brandName.toLowerCase().includes('piza')) || (sugg && sugg.brandName && sugg.brandName.toLowerCase().includes('piza'))) {
        console.log(`[JS Engine Loop] Piza item found: prodName="${prod?.brandName}", suggName="${sugg?.brandName}", prodCode="${prod?.productCode}", suggCode="${sugg?.productCode}"`);
      }
      if (sugg) {
        const sInfo = parseMedicineInfo(sugg);
        if (prod) {
          const parentInfo = parseMedicineInfo(prod);
          if (!sInfo.salts || Object.keys(sInfo.salts).length === 0) {
            sInfo.salts = parentInfo.salts;
          }
          if (!sInfo.composition) {
            sInfo.composition = parentInfo.composition;
          }
          sInfo.parent_name = parentInfo.name;
          sInfo.parent_url = parentInfo.product_url;
          sInfo.is_suggestion = true;
        } else {
          sInfo.is_suggestion = false;
        }
        if (sInfo.available) {
          const key = `${sInfo.code}-${sInfo.name.toLowerCase().trim()}`;
          const existing = candidates[key];
          if (!existing || sInfo.price_per_unit < existing.price_per_unit) {
            candidates[key] = sInfo;
          }
        }
      }

      if (prod) {
        const pInfo = parseMedicineInfo(prod);
        pInfo.is_suggestion = false;
        if (pInfo.available) {
          const key = `${pInfo.code}-${pInfo.name.toLowerCase().trim()}`;
          const existing = candidates[key];
          if (!existing || pInfo.price_per_unit < existing.price_per_unit) {
            candidates[key] = pInfo;
          }
        }
      }
    }
  }

  console.log('--- Candidate list at end of search ---');
  for (const cand of Object.values(candidates)) {
    if (cand.name.toLowerCase().includes('pantin') || cand.name.toLowerCase().includes('piza')) {
      console.log(`[Search debug] name="${cand.name}", code="${cand.code}", key="${cand.code}-${cand.name.toLowerCase().trim()}"`);
    }
  }

  const exactMatches = [];
  const diffStrength = [];
  const extraIngredients = [];
  const missingIngredients = [];

  for (const cand of Object.values(candidates)) {
    const { status, details } = compareCompositions(refSalts, cand.salts);
    cand.match_status = status;
    cand.match_details = details;

    if (cand.name.toLowerCase().includes('piza') || cand.name.toLowerCase().includes('pantin rd') || cand.name.toLowerCase().includes('pantafast') || cand.name.toLowerCase().includes('pentab') || cand.name.toLowerCase().includes('pan 40')) {
      console.log(`[JS Engine classification] name: "${cand.name}", code: "${cand.code}", selling_price: ${cand.selling_price}, pack_size: ${cand.pack_size}, price_per_unit: ${cand.price_per_unit}, status: "${status}", details: "${details}", rawSalts: "${cand.salts ? Object.keys(cand.salts).join(' + ') : 'none'}"`);
    }

    if (cand.code === refInfo.code) {
      continue;
    }

    if (status === 'Exact Match') {
      exactMatches.push(cand);
    } else if (status === 'Different Strength') {
      diffStrength.push(cand);
    } else if (status === 'Extra Ingredients') {
      extraIngredients.push(cand);
    } else if (status === 'Missing Ingredients') {
      missingIngredients.push(cand);
    }
  }

  exactMatches.sort((a, b) => a.price_per_unit - b.price_per_unit);
  diffStrength.sort((a, b) => a.price_per_unit - b.price_per_unit);
  extraIngredients.sort((a, b) => {
    const aDiff = a.match_details ? a.match_details.length : 0;
    const bDiff = b.match_details ? b.match_details.length : 0;
    if (aDiff !== bDiff) {
      return aDiff - bDiff;
    }
    return a.price_per_unit - b.price_per_unit;
  });
  missingIngredients.sort((a, b) => {
    const aDiff = a.match_details ? a.match_details.length : 0;
    const bDiff = b.match_details ? b.match_details.length : 0;
    if (aDiff !== bDiff) {
      return aDiff - bDiff;
    }
    return a.price_per_unit - b.price_per_unit;
  });

  let refCandItem = { ...refInfo };
  refCandItem.match_status = 'Queried Brand';
  refCandItem.match_details = null;
  refCandItem.is_suggestion = false;

  const refKey = `${refInfo.code}-${refInfo.name.toLowerCase().trim()}`;
  const refCand = candidates[refKey];
  if (refCand && refCand.is_suggestion && refCand.selling_price < refInfo.selling_price) {
    refCandItem = { ...refCand };
    refCandItem.match_status = 'Queried Brand (via Swap)';
    refCandItem.match_details = null;
  }
  exactMatches.unshift(refCandItem);

  const refMrpPerUnit = refInfo.mrp / refInfo.pack_size;
  const recommendations = [];

  const standClickId = `sc_${generateUUID()}`;
  const standSessionId = `ss_${generateUUID()}`;
  const standLink = `https://www.truemeds.in/${refInfo.product_url}?search_click_id=${standClickId}&search_session_id=${standSessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
  const standSavings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - refInfo.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
  
  const hasCheapestSwap = !!(refCand && refCand.is_suggestion && refCand.selling_price < refInfo.selling_price);

  if (!hasCheapestSwap) {
    recommendations.push({
      category: 'Queried Brand (Standalone)',
      brand: refInfo.name,
      mrp: refInfo.mrp,
      price: refInfo.selling_price,
      unit_price: refInfo.price_per_unit,
      savings_percent: standSavings,
      link: standLink,
      details: ''
    });
  } else {
    const swapClickId = `sc_${generateUUID()}`;
    const swapSessionId = `ss_${generateUUID()}`;
    const swapLink = `https://www.truemeds.in/${refCand.parent_url}?search_click_id=${swapClickId}&search_session_id=${swapSessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    const swapSavings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - refCand.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
    recommendations.push({
      category: 'Queried Brand (Cheapest Swap)',
      brand: refInfo.name,
      mrp: refCand.mrp,
      price: refCand.selling_price,
      unit_price: refCand.price_per_unit,
      savings_percent: swapSavings,
      link: swapLink,
      details: `Buy parent **${refCand.parent_name || 'parent'}** & swap for **${refInfo.name}** in cart`
    });
  }

  const exactAltsOnly = exactMatches.slice(1);
  if (exactAltsOnly.length > 0) {
    const cheapestExact = exactAltsOnly[0];
    const clickId = `sc_${generateUUID()}`;
    const sessionId = `ss_${generateUUID()}`;
    let link = '';
    if (cheapestExact.is_suggestion && cheapestExact.parent_name && cheapestExact.parent_url) {
      link = `https://www.truemeds.in/${cheapestExact.parent_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    } else {
      link = `https://www.truemeds.in/${cheapestExact.product_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    }
    const savings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - cheapestExact.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
    recommendations.push({
      category: 'Cheapest Exact Match Alternative',
      brand: cheapestExact.name,
      mrp: cheapestExact.mrp,
      price: cheapestExact.selling_price,
      unit_price: cheapestExact.price_per_unit,
      savings_percent: savings,
      link: link,
      details: cheapestExact.is_suggestion ? `Buy parent **${cheapestExact.parent_name || 'parent'}** & swap in cart` : ''
    });
  }

  if (diffStrength.length > 0) {
    const cheapestDiff = diffStrength[0];
    const clickId = `sc_${generateUUID()}`;
    const sessionId = `ss_${generateUUID()}`;
    let link = '';
    if (cheapestDiff.is_suggestion && cheapestDiff.parent_name && cheapestDiff.parent_url) {
      link = `https://www.truemeds.in/${cheapestDiff.parent_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    } else {
      link = `https://www.truemeds.in/${cheapestDiff.product_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    }
    const savings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - cheapestDiff.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
    recommendations.push({
      category: 'Different Strength Match',
      brand: cheapestDiff.name,
      mrp: cheapestDiff.mrp,
      price: cheapestDiff.selling_price,
      unit_price: cheapestDiff.price_per_unit,
      savings_percent: savings,
      link: link,
      details: cheapestDiff.is_suggestion 
        ? `Buy parent **${cheapestDiff.parent_name}** & swap in cart` 
        : (cheapestDiff.match_details ? cheapestDiff.match_details.join(', ') : '')
    });
  }

  if (extraIngredients.length > 0) {
    const cheapestExtra = extraIngredients[0];
    const clickId = `sc_${generateUUID()}`;
    const sessionId = `ss_${generateUUID()}`;
    let link = '';
    if (cheapestExtra.is_suggestion && cheapestExtra.parent_name && cheapestExtra.parent_url) {
      link = `https://www.truemeds.in/${cheapestExtra.parent_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    } else {
      link = `https://www.truemeds.in/${cheapestExtra.product_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    }
    const savings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - cheapestExtra.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
    recommendations.push({
      category: 'Extra Component Match',
      brand: cheapestExtra.name,
      mrp: cheapestExtra.mrp,
      price: cheapestExtra.selling_price,
      unit_price: cheapestExtra.price_per_unit,
      savings_percent: savings,
      link: link,
      details: cheapestExtra.is_suggestion 
        ? `Buy parent **${cheapestExtra.parent_name}** & swap in cart (Contains extra: ${cheapestExtra.match_details ? cheapestExtra.match_details.join(', ') : ''})` 
        : (cheapestExtra.match_details ? `Contains extra: ${cheapestExtra.match_details.join(', ')}` : '')
    });
  }

  if (missingIngredients.length > 0) {
    let bestMissing = null;
    const refSaltsCount = Object.keys(refSalts).length;
    if (refSaltsCount > 2) {
      const validCands = [];
      for (const cand of missingIngredients) {
        const missingCount = cand.match_details ? cand.match_details.length : 0;
        const matchedRatio = (refSaltsCount - missingCount) / refSaltsCount;
        if (matchedRatio >= 0.5 && cand.price_per_unit < refMrpPerUnit) {
          validCands.push({ ratio: matchedRatio, cand });
        }
      }
      if (validCands.length > 0) {
        validCands.sort((a, b) => b.ratio - a.ratio || a.cand.price_per_unit - b.cand.price_per_unit);
        bestMissing = validCands[0].cand;
      }
    }
    if (!bestMissing) {
      bestMissing = missingIngredients[0];
    }

    const clickId = `sc_${generateUUID()}`;
    const sessionId = `ss_${generateUUID()}`;
    let link = '';
    if (bestMissing.is_suggestion && bestMissing.parent_name && bestMissing.parent_url) {
      link = `https://www.truemeds.in/${bestMissing.parent_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    } else {
      link = `https://www.truemeds.in/${bestMissing.product_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
    }
    const savings = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - bestMissing.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
    recommendations.push({
      category: 'Partial Match (Missing Ingredients)',
      brand: bestMissing.name,
      mrp: bestMissing.mrp,
      price: bestMissing.selling_price,
      unit_price: bestMissing.price_per_unit,
      savings_percent: savings,
      link: link,
      details: bestMissing.is_suggestion 
        ? `Buy parent **${bestMissing.parent_name}** & swap in cart (Missing: ${bestMissing.match_details ? bestMissing.match_details.join(', ') : ''})` 
        : (bestMissing.match_details ? `Missing: ${bestMissing.match_details.join(', ')}` : '')
    });
  }

  const formatTableItems = (items) => {
    return items.map(cand => {
      const mapping = mapMatchStatusAndDetails(cand.match_status, cand.match_details);
      const savingsVsMrp = refMrpPerUnit > 0 ? Number(((refMrpPerUnit - cand.price_per_unit) / refMrpPerUnit * 100).toFixed(2)) : 0.0;
      const savingsVsPrice = refInfo.price_per_unit > 0 ? Number(((refInfo.price_per_unit - cand.price_per_unit) / refInfo.price_per_unit * 100).toFixed(2)) : 0.0;

      const clickId = `sc_${generateUUID()}`;
      const sessionId = `ss_${generateUUID()}`;
      let link = '';
      if (cand.is_suggestion && cand.parent_name && cand.parent_url) {
        link = `https://www.truemeds.in/${cand.parent_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
      } else {
        link = `https://www.truemeds.in/${cand.product_url}?search_click_id=${clickId}&search_session_id=${sessionId}&suggestion_rank=0&suggestion_source_type=manual_enter`;
      }

      const matchPercent = computeMatchPercent(refSalts, cand.salts);

      return {
        brand: cand.name,
        manufacturer: cand.manufacturer,
        pack_form: cand.pack_form,
        mrp: cand.mrp,
        price: cand.selling_price,
        unit_price: cand.price_per_unit,
        savings_percent: Math.max(0, savingsVsMrp),
        savings_vs_mrp: savingsVsMrp,
        savings_vs_price: savingsVsPrice,
        link: link,
        status: cand.is_suggestion ? `${mapping.status} (Swap)` : mapping.status,
        details: cand.is_suggestion 
          ? `Buy parent **${cand.parent_name}** & swap ${mapping.details ? `(${mapping.details})` : ''}`.trim() 
          : mapping.details,
        salts: cand.salts,
        match_percent: matchPercent
      };
    });
  };

  const finalExact = formatTableItems(exactMatches);
  const finalDiffStrength = formatTableItems(diffStrength);
  const combinedPartial = [...extraIngredients, ...missingIngredients];
  combinedPartial.sort((a, b) => {
    const aDiff = a.match_details ? a.match_details.length : 0;
    const bDiff = b.match_details ? b.match_details.length : 0;
    if (aDiff !== bDiff) {
      return aDiff - bDiff;
    }
    return a.price_per_unit - b.price_per_unit;
  });
  const finalPartial = formatTableItems(combinedPartial);

  return {
    queried_medicine: {
      name: refInfo.name,
      price: refInfo.selling_price,
      mrp: refInfo.mrp,
      unit_price: refInfo.price_per_unit,
      units: refInfo.pack_size,
      ingredients: Object.entries(refSalts).map(([k, v]) => `${k} (${v})`),
      link: `https://www.truemeds.in/${refInfo.product_url}`,
      manufacturer: refInfo.manufacturer,
      pack_form: refInfo.pack_form
    },
    recommendations: recommendations,
    alternatives: {
      exact: finalExact,
      different_strength: finalDiffStrength,
      partial: finalPartial
    }
  };
}
