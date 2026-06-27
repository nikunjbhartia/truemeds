// src/tests/helpers/parity-md-parser.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable parser for the Markdown reports produced by
//   python/substitute_finder.py
//
// Public surface:
//   parseMarkdownTables(md)        → [{ headers: string[], rows: string[][] }]
//   parseReferenceBlock(md)        → { name, price, pack_size, unit_price, composition[] }
//   extractAlternativeRows(md)     → canonical 10-field records (see below)
//   normalizeUuids(str)            → strips sc_<uuid>/ss_<uuid> tokens
//   canonicalStatus(rawStatus)     → 'Exact Match' | 'Diff Strength' | ...
//   stripDecorations(cell)         → drops `**…**`, `*…*`, `[x] `, `[ ] `
//   parseRupees / parsePercent     → number | null
//
// Record schema (per alternative row):
//   {
//     status:        string,    // 'Exact Match' | 'Diff Strength' | 'Extra Component' | 'Missing'
//     details:       string,    // free-form payload kept after the status keyword
//     brand:         string,
//     manufacturer:  string,
//     pack_form:     string,
//     pack_mrp:      number,    // rupees
//     pack_price:    number,
//     unit_price:    number,
//     savings_pct:   number,    // 0–100
//     link:          string,    // UUID-normalized truemeds.in URL
//   }

// ─────────────────────────────────────────────────────────────────────────────
// UUID normalization — both v4 (`4xxx-yxxx`) and any-version fallback.
// ─────────────────────────────────────────────────────────────────────────────
export const UUID_RE =
  /(sc_|ss_)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function normalizeUuids(s) {
  if (typeof s !== 'string') return s;
  return s.replace(UUID_RE, (_m, prefix) => `${prefix}__UUID__`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell-level helpers.
// ─────────────────────────────────────────────────────────────────────────────
export function stripDecorations(s) {
  let out = String(s ?? '').trim();
  // First peel symmetric outer emphasis once so `**[x] **Status**` shape works.
  for (let k = 0; k < 3; k += 1) {
    const next = out
      .replace(/^\*\*([\s\S]+)\*\*$/, '$1').trim()
      .replace(/^\*([\s\S]+)\*$/, '$1').trim();
    if (next === out) break;
    out = next;
  }
  // Strip the leading `[x] ` / `[ ] ` task-box (may itself be wrapped).
  out = out.replace(/^\*{0,2}\s*\[[xX ]\]\s*\*{0,2}\s*/, '').trim();
  // The Python emitter produces asymmetric wrappers like
  //   `[x] **Exact Match**`  → after `[x]` strip becomes `**Exact Match**`
  //   `[ ] *Diff Strength (...)*` → after `[ ]` strip becomes `*Diff Strength (...)*`
  // …so peel one more round of symmetric emphasis.
  for (let k = 0; k < 3; k += 1) {
    const next = out
      .replace(/^\*\*([\s\S]+)\*\*$/, '$1').trim()
      .replace(/^\*([\s\S]+)\*$/, '$1').trim();
    if (next === out) break;
    out = next;
  }
  // Defensive: trim a dangling single `*` that asymmetric stripping may have
  // left (e.g. `Diff Strength (...)*` when the leading `*` was eaten by the
  // task-box regex's `\*{0,2}` capture).
  out = out.replace(/^\*+|\*+$/g, '').trim();
  return out;
}

export function parseRupees(s) {
  const t = stripDecorations(s);
  if (!t || t === '-' || t === '—') return null;
  // Pull the first signed decimal — handles "Rs. 140.24", "₹140.24", "140".
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parsePercent(s) {
  const t = stripDecorations(s);
  if (!t) return null;
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Map a status cell to (canonical short tag, details payload).
 * Mirrors the JS engine's `mapMatchStatusAndDetails` output, so deep-equality
 * works without further massaging on the JS side.
 */
export function canonicalStatus(rawStatus) {
  const s = stripDecorations(rawStatus);
  if (!s) return { status: '', details: '' };

  if (/^Queried Brand/i.test(s)) {
    const swap = /via Swap/i.test(s);
    return { status: 'Queried Brand', details: swap ? 'via Swap' : '' };
  }
  if (/^Exact Match/i.test(s)) return { status: 'Exact Match', details: '' };
  if (/^Diff(?:erent)? Strength/i.test(s)) {
    const m = s.match(/\((.+)\)\s*$/);
    return { status: 'Diff Strength', details: m ? m[1].trim() : '' };
  }
  if (/^Extra (?:Component|Ingredient)/i.test(s)) {
    const m = s.match(/\((?:Contains extra:\s*)?(.+)\)\s*$/i);
    return { status: 'Extra Component', details: m ? m[1].trim() : '' };
  }
  if (/^Missing[: ]/i.test(s)) {
    const rest = s.replace(/^Missing[: ]\s*/i, '').trim();
    return { status: 'Missing', details: rest };
  }
  return { status: s, details: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown table parser (GFM-style).
// ─────────────────────────────────────────────────────────────────────────────
function splitRow(line) {
  // Protect `\|` and pipes inside `[label](url)` link bodies (defensive —
  // current emitter never produces them, but bullet-proof against the future).
  let i = 0;
  const linkMasked = line.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => {
    i += 1;
    return m.replace(/\|/g, `\u0001PIPE${i}\u0001`);
  });
  const escapedMasked = linkMasked.replace(/\\\|/g, '\u0001ESCPIPE\u0001');
  const parts = escapedMasked.split('|').map((s) =>
    s.replace(/\u0001ESCPIPE\u0001/g, '|')
     .replace(/\u0001PIPE\d+\u0001/g, '|')
     .trim()
  );
  if (parts.length && parts[0] === '') parts.shift();
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function isSeparator(line) {
  return /^\s*\|?[\s\-:|]+\|?\s*$/.test(line) && /-/.test(line);
}

export function parseMarkdownTables(md) {
  const lines = String(md ?? '').split(/\r?\n/);
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]) && !isSeparator(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      tables.push({ headers, rows });
      continue;
    }
    i += 1;
  }
  return tables;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescribed-medicine reference-block parser.
//
// The Python emitter writes:
//   # Medicine Alternatives Report
//
//   **Queried Reference Medicine**: <name> (Pack Price: Rs. <price>
//     for <pack_size> units - Rs. <unit_price>/unit)
//
//   **Composition Ingredients**: salt1 (qty1), salt2 (qty2), ...
// ─────────────────────────────────────────────────────────────────────────────
export function parseReferenceBlock(md) {
  const text = String(md ?? '');

  // Be tolerant of:
  //   - "Rs. 140.24"  vs  "Rs.140.24"
  //   - integer pack size ("15") vs float ("15.0")
  //   - extra surrounding whitespace and the literal `**` wrappers
  const refRe = new RegExp(
    String.raw`\*\*Queried Reference Medicine\*\*\s*:\s*(.+?)\s*\(\s*Pack Price\s*:\s*Rs\.\s*([\d.]+)\s+for\s+([\d.]+)\s+units\s*-\s*Rs\.\s*([\d.]+)\s*/\s*unit\s*\)`,
    'i'
  );
  const m = text.match(refRe);
  if (!m) {
    throw new Error('parseReferenceBlock: could not match reference line');
  }
  const [, name, price, packSize, unitPrice] = m;

  // Composition line: "**Composition Ingredients**: A (10 mg), B (5 mg)"
  // Each entry parsed as "<name> (<strength>)" — empty strength tolerated.
  const compRe = /\*\*Composition Ingredients\*\*\s*:\s*(.+)/i;
  const c = text.match(compRe);
  const compositionRaw = c ? c[1].trim() : '';
  const composition = compositionRaw
    ? compositionRaw.split(/\s*,\s*(?=[^()]*(?:\(|$))/) // split on commas that aren't inside parens
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    name: stripDecorations(name).trim(),
    price: Number(price),
    pack_size: Number(packSize),
    unit_price: Number(unitPrice),
    composition,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section-row → canonical record.
//
// Per-category section table headers (10 columns):
//   0 No. | 1 Status | 2 Brand | 3 Manufacturer | 4 Pack Form
//   5 Pack MRP | 6 Pack Selling Price | 7 Price/Unit | 8 Saving % | 9 Instructions
// ─────────────────────────────────────────────────────────────────────────────
function extractLinkFromInstruction(cell) {
  if (!cell) return '';
  const md = cell.match(/\]\((https?:\/\/[^)\s]+)\)/);
  if (md) return md[1];
  const bare = cell.match(/https?:\/\/[^\s)]+/);
  return bare ? bare[0] : '';
}

function rowToRecord(row) {
  if (row.length < 10) return null;
  const brand = stripDecorations(row[2]);
  if (!brand) return null;
  if (/no matches found/i.test(row[1] || '')) return null;

  const { status, details } = canonicalStatus(row[1]);
  return {
    status,
    details,
    brand,
    manufacturer: stripDecorations(row[3]),
    pack_form:    stripDecorations(row[4]),
    pack_mrp:     parseRupees(row[5]),
    pack_price:   parseRupees(row[6]),
    unit_price:   parseRupees(row[7]),
    savings_pct:  parsePercent(row[8]),
    link:         normalizeUuids(extractLinkFromInstruction(row[9])),
  };
}

export function extractAlternativeRows(md) {
  const tables = parseMarkdownTables(md);
  const records = [];
  for (const tbl of tables) {
    // Per-category sections have exactly 10 columns; the summary table has 7.
    if (tbl.headers.length !== 10) continue;
    for (const row of tbl.rows) {
      const rec = rowToRecord(row);
      if (rec) records.push(rec);
    }
  }
  return records;
}
