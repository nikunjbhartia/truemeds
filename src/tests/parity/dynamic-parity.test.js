// src/tests/parity/dynamic-parity.test.js
//
// Tier 4 — Dynamic Parity Test Suite (R6, post-QA-audit).
// ─────────────────────────────────────────────────────────────────────────────
//   For each pilot brand:
//     1. Shell out to `python3 python/substitute_finder.py "<query>"`.
//        The script writes /Users/nikunjbhartia/truemeds/<slug>_substitutes.md.
//        SLUG is derived from the live API's `skuName`, NOT the user query,
//        so we DISCOVER the produced file at runtime via mtime-newest glob.
//     2. Parse the Markdown into:
//          • a Prescribed-Medicine metadata block,
//          • a flat list of alternative rows across all 4 section tables.
//     3. Run the JS engine on the same query against the raw API fixtures
//        (routed by helpers/mock-fetch.js). Critically we BYPASS the engine's
//        built-in MOCK_MAPPING short-circuit so we're comparing live computation
//        on both sides.
//     4. Normalize UUID tokens (`sc_/ss_<uuid>` → `sc___UUID__/ss___UUID__`)
//        and compare row-set under (status, brand, details) ordering, with
//        ±0.05 tolerance on every numeric field.
//     5. afterAll cleans up every generated `.md` so the workspace stays tidy.
//
// Environment switches
// ─────
//   RUN_DYNAMIC_PARITY=1   force-run even if connectivity probe fails
//   PARITY_HEAVY=1         include the Aptamil pilot (~60s alone)
//   PARITY_FROM_FIXTURE=1  skip subprocess; copy canonical .md from
//                          src/tests/fixtures/parity/<discoveredSlug>.md
//   PYTHON_BIN=python3.11  override the interpreter
//   PARITY_TIMEOUT_MS=120000

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  existsSync, readFileSync, statSync, mkdirSync, unlinkSync,
  readdirSync, copyFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import * as net from 'node:net';

import { findSubstitutes, MOCK_MAPPING } from '@/js/substitute-finder.js';
import { installFetchMockFromDir } from '../helpers/mock-fetch.js';
import {
  UUID_RE,
  normalizeUuids,
  parseReferenceBlock,
  extractAlternativeRows,
  canonicalStatus,
} from '../helpers/parity-md-parser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pilots — `query` is what we pass to the CLI; `fixtureDir` is the raw-API
// fixture subtree consumed by mock-fetch. Slug is DISCOVERED at runtime.
// ─────────────────────────────────────────────────────────────────────────────
const ALL_PILOTS = [
  { query: 'Pan 40',                 fixtureDir: 'pan_40_tablet_15' },
  { query: 'Ecosprin 75',            fixtureDir: 'ecosprin_75_tablet_14' },
  { query: 'Ecoflora Capsule',       fixtureDir: 'ecoflora_capsule_30' },
  { query: 'Pantomore Dsr Capsule',  fixtureDir: 'pantomore_dsr_capsule_10' },
];
const HEAVY_PILOTS = [
  { query: 'Aptamil Premium Stage 1', fixtureDir: 'aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm' },
];
const PILOTS = process.env.PARITY_HEAVY === '1'
  ? [...ALL_PILOTS, ...HEAVY_PILOTS]
  : ALL_PILOTS;

const REPO_ROOT          = process.cwd();
const PY_SCRIPT          = resolve(REPO_ROOT, 'python', 'substitute_finder.py');
const REPORT_DIR         = resolve(REPO_ROOT, 'python', 'reports');
const FIXTURE_API_ROOT   = resolve(REPO_ROOT, 'src', 'tests', 'fixtures', 'api');
const PARITY_MD_FIXTURES = resolve(REPO_ROOT, 'src', 'tests', 'fixtures', 'parity');

const PYTHON_BIN        = process.env.PYTHON_BIN || 'python3';
const SCRIPT_TIMEOUT_MS = Number(process.env.PARITY_TIMEOUT_MS || 90_000);
const FORCE_RUN         = process.env.RUN_DYNAMIC_PARITY === '1';
const USE_FIXTURE_MD    = process.env.PARITY_FROM_FIXTURE === '1';

// ─────────────────────────────────────────────────────────────────────────────
// Gate: skip entire suite if (a) script missing, OR (b) interpreter missing,
// OR (c) Truemeds host unreachable AND we're not running from canned fixtures
// AND user didn't pass RUN_DYNAMIC_PARITY=1.
// ─────────────────────────────────────────────────────────────────────────────
function pythonAvailable() {
  if (!existsSync(PY_SCRIPT)) return false;
  try {
    execFileSync(PYTHON_BIN, ['-c', 'import sys; sys.exit(0)'],
                 { stdio: 'ignore', timeout: 5_000 });
    return true;
  } catch { return false; }
}

function truemedsReachable(timeoutMs = 2_000) {
  return new Promise((resolveProbe) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; sock.destroy(); resolveProbe(ok); } };
    sock.setTimeout(timeoutMs);
    sock.once('connect',    () => finish(true));
    sock.once('error',      () => finish(false));
    sock.once('timeout',    () => finish(false));
    try { sock.connect(443, 'nal.tmmumbai.in'); } catch { finish(false); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug discovery — pick the *_substitutes.md whose mtime is >= probeStart.
// ─────────────────────────────────────────────────────────────────────────────
function discoverFreshReport(reportDir, probeStartMs) {
  if (!existsSync(reportDir)) return null;
  const candidates = readdirSync(reportDir)
    .filter((f) => f.endsWith('_substitutes.md'))
    .map((f) => {
      const full = join(reportDir, f);
      let mtime = 0;
      try { mtime = statSync(full).mtimeMs; } catch { /* ignore */ }
      return { full, file: f, mtime };
    })
    .filter((x) => x.mtime >= probeStartMs - 1500)   // 1.5s skew tolerance
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// JS engine projection — emit the same record shape as the markdown parser.
// We MUST bypass `MOCK_MAPPING` so the engine actually runs against the mock
// fetch rather than returning the pre-baked golden JSON.
// ─────────────────────────────────────────────────────────────────────────────
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
    link:         normalizeUuids(String(item.link ?? '')),
  };
}

function projectEngineOutput(out) {
  const records = [];
  for (const it of altGroup(out, 'exact'))
    records.push(jsRowToRecord(it, 'Exact Match'));
  for (const it of altGroup(out, 'different_strength', 'diff_strength'))
    records.push(jsRowToRecord(it, 'Diff Strength'));
  // The JS engine merges Extra and Missing into `partial`; split by status.
  for (const it of altGroup(out, 'partial', 'extra', 'missing', 'extra_ingredients', 'missing_ingredients')) {
    const guess = it.status || (it.details?.startsWith('Missing') ? 'Missing' : 'Extra Component');
    records.push(jsRowToRecord(it, guess));
  }
  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort by a stable composite key (status, brand, details) so deep-equal works
// regardless of the implementation's emission order.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeDetails(details) {
  if (!details) return '';
  return details.split(/\s*,\s*/)
    .map(s => s.trim().toLowerCase())
    .sort()
    .join(', ');
}

function recordKey(r) { return `${r.status}\u0001${r.brand}\u0001${normalizeDetails(r.details)}`; }
function sortRecords(rs) {
  return [...rs].sort((a, b) => recordKey(a) < recordKey(b) ? -1 : recordKey(a) > recordKey(b) ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Numeric tolerance: ±0.05 absolute (one paise / 0.05 percent).
// We do NOT round both sides to 2dp — that hid genuine drift in the previous
// cut. Instead we compare strict on string fields and tolerant on numerics.
// ─────────────────────────────────────────────────────────────────────────────
const NUMERIC_FIELDS = ['pack_mrp', 'pack_price', 'unit_price', 'savings_pct'];
const TOL = 0.05;

function assertRowEqual(jsRow, pyRow, ctx) {
  for (const f of ['status', 'brand', 'manufacturer', 'pack_form', 'link']) {
    expect(jsRow[f], `${ctx}.${f}`).toBe(pyRow[f]);
  }
  expect(normalizeDetails(jsRow.details), `${ctx}.details`).toBe(normalizeDetails(pyRow.details));
  for (const f of NUMERIC_FIELDS) {
    if (pyRow[f] == null) {
      expect(jsRow[f], `${ctx}.${f}`).toBeNull();
    } else {
      expect(Math.abs(jsRow[f] - pyRow[f]), `${ctx}.${f} (js=${jsRow[f]} py=${pyRow[f]})`)
        .toBeLessThanOrEqual(TOL);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved at suite load — async, so we await inside the top-level describe.
// ─────────────────────────────────────────────────────────────────────────────
let connectivityOk = false;
let runSuite = false;

beforeAll(async () => {
  if (USE_FIXTURE_MD) { runSuite = pythonAvailable() || true; return; }   // fixtures mode needs nothing
  if (!pythonAvailable()) { runSuite = false; return; }
  connectivityOk = await truemedsReachable();
  runSuite = FORCE_RUN || connectivityOk;
});

// We must register the per-brand cases at module-load time (Vitest cannot
// register tests inside an async beforeAll), so the *outer* gate uses the
// cheap synchronous predicates and surfaces a single skip if needed.
const SUITE_SHOULD_RUN = USE_FIXTURE_MD || pythonAvailable();
const describeMaybe = SUITE_SHOULD_RUN ? describe : describe.skip;

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describeMaybe('Tier 4 — Dynamic Parity (Python Markdown ↔ JS Engine)', () => {
  const originalFetch = globalThis.fetch;

  // Track every report we created so afterAll can wipe them.
  const createdReports = new Set();

  beforeAll(() => {
    try { mkdirSync(REPORT_DIR, { recursive: true }); } catch { /* ignore */ }
  });



  describe.each(PILOTS)('$query', ({ query, fixtureDir }) => {
    let markdown      = '';
    let reportPath    = '';
    let pyReference   = null;
    let pythonRecords = [];
    let jsOutput      = null;
    let jsRecords     = [];
    let brandSkipReason = null;

    beforeAll(async () => {
      const probeStart = Date.now();

      // ── 1. Source the markdown ──────────────────────────────────────────
      if (USE_FIXTURE_MD) {
        const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const src = join(PARITY_MD_FIXTURES, `${slug}.md`);
        if (!existsSync(src)) {
          brandSkipReason = `fixture missing: ${src}`;
          return;
        }
        reportPath = join(REPORT_DIR, `${slug}_substitutes.md`);
        copyFileSync(src, reportPath);
      } else {
        if (!runSuite) { brandSkipReason = 'connectivity probe failed; set RUN_DYNAMIC_PARITY=1 to force'; return; }

        // Snapshot existing reports so we can detect what's NEW.
        try {
          execFileSync(PYTHON_BIN, [PY_SCRIPT, ...query.split(/\s+/)], {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: SCRIPT_TIMEOUT_MS,
            encoding: 'utf-8',
            env: { ...process.env, MOCK_FIXTURE_DIR: fixtureDir }
          });
        } catch (err) {
          const stderr = err.stderr?.toString() ?? '';
          throw new Error(
            `python script failed for "${query}":\n` +
            `  status=${err.status} signal=${err.signal}\n` +
            `  stderr: ${stderr.slice(0, 500)}`
          );
        }

        reportPath = discoverFreshReport(REPORT_DIR, probeStart);
        if (!reportPath) {
          brandSkipReason = `python produced no *_substitutes.md in ${REPORT_DIR} since ${new Date(probeStart).toISOString()}`;
          return;
        }
      }
      createdReports.add(reportPath);

      // ── 2. Parse markdown ───────────────────────────────────────────────
      const stat = statSync(reportPath);
      if (stat.size === 0) throw new Error(`empty report at ${reportPath}`);
      markdown      = readFileSync(reportPath, 'utf-8');
      pyReference   = parseReferenceBlock(markdown);
      pythonRecords = sortRecords(extractAlternativeRows(markdown));

      // ── 3. Run JS engine against the same RAW fixtures ─────────────────
      const brandFixtureDir = join(FIXTURE_API_ROOT, fixtureDir);
      if (!existsSync(brandFixtureDir)) {
        throw new Error(`Missing raw API fixture directory: ${brandFixtureDir}`);
      }
      installFetchMockFromDir(fixtureDir);

      // Bypass the engine's MOCK_MAPPING short-circuit so we get the dynamic
      // fetch computation path. We temporarily clear the mapping keys, call the
      // finder, and restore the keys in a finally block to prevent side effects.
      const savedMapping = { ...MOCK_MAPPING };
      for (const key of Object.keys(MOCK_MAPPING)) {
        delete MOCK_MAPPING[key];
      }

      try {
        jsOutput = await findSubstitutes(query);
      } finally {
        Object.assign(MOCK_MAPPING, savedMapping);
      }

      if (!jsOutput) throw new Error(`findSubstitutes("${query}") returned null`);
      jsRecords = sortRecords(projectEngineOutput(jsOutput));
    }, SCRIPT_TIMEOUT_MS + 30_000);

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('python produced a parseable report', () => {
      if (brandSkipReason) { console.warn(`[skip] ${query}: ${brandSkipReason}`); return; }
      expect(markdown).toMatch(/^# Medicine Alternatives Report/m);
      expect(pythonRecords.length).toBeGreaterThan(0);
    });

    it('reference-medicine metadata block matches the JS engine', () => {
      if (brandSkipReason) return;
      const ref = pyReference;
      expect(ref).toMatchObject({
        name: expect.any(String),
        composition: expect.any(Array),
      });
      const qm = jsOutput.queried_medicine;
      // Strings: exact.
      expect(qm.name).toBe(ref.name);
      // Numbers: ±0.05 tolerance.
      expect(Math.abs(qm.price       - ref.price)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(qm.units       - ref.pack_size)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(qm.unit_price  - ref.unit_price)).toBeLessThanOrEqual(TOL);
      // Composition: same set (order irrelevant).
      expect([...qm.ingredients].sort()).toEqual([...ref.composition].sort());
    });

    it('JS engine produced at least one alternative row', () => {
      if (brandSkipReason) return;
      expect(jsRecords.length).toBeGreaterThan(0);
    });

    it('every parsed Python row has all 9 required fields populated', () => {
      if (brandSkipReason) return;
      for (const r of pythonRecords) {
        expect(r.status,        `status @ ${r.brand}`).not.toBe('');
        expect(r.brand,         'brand').not.toBe('');
        expect(r.manufacturer,  `manufacturer @ ${r.brand}`).not.toBe('');
        expect(r.pack_form,     `pack_form @ ${r.brand}`).not.toBe('');
        expect(r.pack_mrp,      `pack_mrp @ ${r.brand}`).not.toBeNull();
        expect(r.pack_price,    `pack_price @ ${r.brand}`).not.toBeNull();
        expect(r.unit_price,    `unit_price @ ${r.brand}`).not.toBeNull();
        expect(r.savings_pct,   `savings_pct @ ${r.brand}`).not.toBeNull();
        expect(r.link,          `link @ ${r.brand}`).toMatch(
          /^https:\/\/www\.truemeds\.in\/.*search_click_id=sc___UUID__&search_session_id=ss___UUID__/
        );
      }
    });

    it('every checkout link is UUID-normalized on both sides', () => {
      if (brandSkipReason) return;
      for (const r of [...pythonRecords, ...jsRecords]) {
        if (r.link) expect(r.link).not.toMatch(UUID_RE);
      }
    });

    it('brand sets match (early-fail diagnostic)', () => {
      if (brandSkipReason) return;
      const pyKeys = new Set(pythonRecords.map(recordKey));
      const jsKeys = new Set(jsRecords.map(recordKey));
      const onlyPy = [...pyKeys].filter((k) => !jsKeys.has(k));
      const onlyJs = [...jsKeys].filter((k) => !pyKeys.has(k));
      if (onlyPy.length || onlyJs.length) {
        console.log(`[PARITY MISMATCH for "${query}"]`);
        console.log("Only in Python:", onlyPy);
        console.log("Only in JS:", onlyJs);
      }
      expect({ onlyPy, onlyJs }).toEqual({ onlyPy: [], onlyJs: [] });
    });

    it('every row matches field-by-field (numerics with ±0.05 tolerance)', () => {
      if (brandSkipReason) return;
      expect(jsRecords.length).toBe(pythonRecords.length);
      for (let idx = 0; idx < pythonRecords.length; idx += 1) {
        assertRowEqual(jsRecords[idx], pythonRecords[idx],
          `row[${idx}] (${pythonRecords[idx].status}|${pythonRecords[idx].brand})`);
      }
    });
  });
});
