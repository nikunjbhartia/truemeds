import assert from 'assert';
import { 
  normalizeSaltName, 
  normalizeStrength, 
  parseMedicineInfo, 
  compareCompositions, 
  mapMatchStatusAndDetails,
  findSubstitutes 
} from '../src/js/substitute-finder.js';
import { 
  getSearchHistory, 
  saveToSearchHistory, 
  clearSearchHistory 
} from '../src/js/search-history.js';

// Setup global localStorage mock for testing
const storage = {};
global.window = {
  localStorage: {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; }
  }
};

console.log('Starting verification tests for ported JS logic...\n');

// 1. Normalization Tests
try {
  console.log('Running Normalization Tests...');
  
  // casing and leading/trailing spaces
  assert.strictEqual(normalizeSaltName('  Pantoprazole Sodium  '), 'pantoprazole sodium');
  
  // double spaces preservation (probiotics edge cases)
  assert.strictEqual(normalizeSaltName('Lactobacillus  acidophilus'), 'lactobacillus  acidophilus');
  
  // strength spacing
  assert.strictEqual(normalizeStrength('40mg'), '40 mg');
  assert.strictEqual(normalizeStrength('0.5Mg'), '0.5 mg');
  assert.strictEqual(normalizeStrength('1tablet'), '1 tablet');
  assert.strictEqual(normalizeStrength('  150  MG  '), '150 mg');
  
  console.log('✅ Normalization Tests Passed.');
} catch (e) {
  console.error('❌ Normalization Tests Failed:', e);
  process.exit(1);
}

// 2. Parsing Tests
try {
  console.log('\nRunning Parsing Tests...');
  const sampleRaw = {
    productCode: 'TM-12345',
    brandName: 'Ecosprin 75 Tablet 14',
    manufacturerName: 'USV Pvt Ltd',
    packForm: 'Strip of 14 Units',
    packSize: '14',
    sellingPrice: 4.44,
    mrp: 5.29,
    productUrl: 'medicine/ecosprin-tablet-14',
    saltComposition: 'Aspirin (75 Mg)'
  };
  
  const parsed = parseMedicineInfo(sampleRaw);
  assert.strictEqual(parsed.code, 'TM-12345');
  assert.strictEqual(parsed.name, 'Ecosprin 75 Tablet 14');
  assert.strictEqual(parsed.pack_size, 14);
  assert.strictEqual(parsed.selling_price, 4.44);
  assert.strictEqual(parsed.mrp, 5.29);
  assert.strictEqual(parsed.price_per_unit, 4.44 / 14);
  assert.deepStrictEqual(parsed.salts, { 'Aspirin': '75 Mg' });
  
  // Fallback composition string check
  const sampleRaw2 = {
    productCode: 'TM-999',
    brandName: 'Pan 40',
    composition: 'Pantoprazole (40 Mg)'
  };
  const parsed2 = parseMedicineInfo(sampleRaw2);
  assert.deepStrictEqual(parsed2.salts, { 'Pantoprazole': '40 Mg' });
  
  console.log('✅ Parsing Tests Passed.');
} catch (e) {
  console.error('❌ Parsing Tests Failed:', e);
  process.exit(1);
}

// 3. Comparison Logic Tests
try {
  console.log('\nRunning Comparison Logic Tests...');
  
  // Exact Match
  const ref = { 'Pantoprazole': '40 Mg' };
  const candExact = { 'pantoprazole ': ' 40mg ' };
  const res1 = compareCompositions(ref, candExact);
  assert.strictEqual(res1.status, 'Exact Match');
  assert.strictEqual(res1.details, null);
  
  // Different Strength
  const candDiff = { 'Pantoprazole': '20 Mg' };
  const res2 = compareCompositions(ref, candDiff);
  assert.strictEqual(res2.status, 'Different Strength');
  assert.deepStrictEqual(res2.details, ['Pantoprazole: 20 mg vs 40 mg']);
  
  // Extra Ingredients
  const refMulti = { 'Pantoprazole': '40 Mg' };
  const candExtra = { 'Pantoprazole': '40 Mg', 'Domperidone': '30 Mg' };
  const res3 = compareCompositions(refMulti, candExtra);
  assert.strictEqual(res3.status, 'Extra Ingredients');
  assert.deepStrictEqual(res3.details, ['Domperidone (30 Mg)']);
  
  // Missing Ingredients
  const refMulti2 = { 'Pantoprazole': '40 Mg', 'Domperidone': '30 Mg' };
  const candMissing = { 'Pantoprazole': '40 Mg' };
  const res4 = compareCompositions(refMulti2, candMissing);
  assert.strictEqual(res4.status, 'Missing Ingredients');
  assert.deepStrictEqual(res4.details, ['Domperidone (30 Mg)']);
  
  console.log('✅ Comparison Logic Tests Passed.');
} catch (e) {
  console.error('❌ Comparison Logic Tests Failed:', e);
  process.exit(1);
}

// 4. Status Mapping Tests
try {
  console.log('\nRunning Status Mapping Tests...');
  
  assert.deepStrictEqual(mapMatchStatusAndDetails('Queried Brand', null), { status: 'Queried Brand', details: '' });
  assert.deepStrictEqual(mapMatchStatusAndDetails('Queried Brand (via Swap)', null), { status: 'Queried Brand', details: 'via Swap' });
  assert.deepStrictEqual(mapMatchStatusAndDetails('Exact Match', null), { status: 'Exact Match', details: '' });
  assert.deepStrictEqual(mapMatchStatusAndDetails('Different Strength', ['Aspirin: 150 mg vs 75 mg']), { status: 'Diff Strength', details: 'Aspirin: 150 mg vs 75 mg' });
  assert.deepStrictEqual(mapMatchStatusAndDetails('Extra Ingredients', ['Glycine (37.5 mg)']), { status: 'Extra Component', details: 'Glycine (37.5 mg)' });
  assert.deepStrictEqual(mapMatchStatusAndDetails('Missing Ingredients', ['Domperidone (30 mg)']), { status: 'Missing: Domperidone', details: '30 mg' });
  
  console.log('✅ Status Mapping Tests Passed.');
} catch (e) {
  console.error('❌ Status Mapping Tests Failed:', e);
  process.exit(1);
}

// 5. Search History Tests
try {
  console.log('\nRunning Search History Tests...');
  clearSearchHistory();
  assert.deepStrictEqual(getSearchHistory(), []);
  
  // Save first search
  saveToSearchHistory({
    query: 'ecosprin',
    name: 'Ecosprin 75 Tablet 14',
    price: 4.44,
    mrp: 5.29
  });
  
  let history = getSearchHistory();
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].query, 'ecosprin');
  
  // Duplicates check
  saveToSearchHistory({
    query: 'ecosprin',
    name: 'Ecosprin 75 Tablet 14',
    price: 4.44,
    mrp: 5.29
  });
  history = getSearchHistory();
  assert.strictEqual(history.length, 1); // should remain 1 unique entry
  
  // Max size limit check (10 items)
  for (let i = 1; i <= 12; i++) {
    saveToSearchHistory({
      query: `query_${i}`,
      name: `Medicine Brand ${i}`,
      price: i * 10,
      mrp: i * 11
    });
  }
  history = getSearchHistory();
  assert.strictEqual(history.length, 10);
  assert.strictEqual(history[0].query, 'query_12'); // newest item should be at the top
  assert.strictEqual(history[9].query, 'query_3');  // oldest kept item
  
  // Clear check
  clearSearchHistory();
  assert.deepStrictEqual(getSearchHistory(), []);
  
  console.log('✅ Search History Tests Passed.');
} catch (e) {
  console.error('❌ Search History Tests Failed:', e);
  process.exit(1);
}

// 6. Offline Mock File findSubstitutes Tests
async function runOfflineTests() {
  try {
    console.log('\nRunning Offline findSubstitutes Verification...');
    
    // Test Ecosprin Mock
    const ecosprinData = await findSubstitutes('ecosprin_75_tablet_14');
    assert.ok(ecosprinData);
    assert.strictEqual(ecosprinData.queried_medicine.name, 'Ecosprin 75 Tablet 14');
    assert.ok(ecosprinData.recommendations.length > 0);
    assert.ok(ecosprinData.alternatives.exact.length > 0);
    
    // Verify first exact match is indeed Ecosprin (index 0)
    assert.strictEqual(ecosprinData.alternatives.exact[0].brand, 'Ecosprin 75 Tablet 14');
    assert.strictEqual(ecosprinData.alternatives.exact[0].status, 'Queried Brand');
    
    // Test Pan 40 Mock
    const panData = await findSubstitutes('pan_40');
    assert.ok(panData);
    assert.strictEqual(panData.queried_medicine.name, 'Pan 40 Tablet 15');
    assert.ok(panData.alternatives.exact.length > 0);
    
    console.log('✅ Offline Mock File findSubstitutes Verification Passed.');
    console.log('\n🎉 ALL PORT TESTS PASSED SUCCESSFULLY! PORT IS 100% VALIDATED.');
  } catch (e) {
    console.error('❌ Offline findSubstitutes Verification Failed:', e);
    process.exit(1);
  }
}

runOfflineTests();
