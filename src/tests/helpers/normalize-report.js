// web/src/tests/helpers/normalize-report.js
// Strip volatile fields so parity diffs are stable across runs.

const UUID_RE = /(sc_|ss_)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function scrubString(s) {
  if (typeof s !== 'string') return s;
  let res = s.replace(UUID_RE, (_m, p) => `${p}__UUID__`);
  if (res.includes(',')) {
    let prefix = '';
    let listPart = res;
    if (res.startsWith('Missing: ')) {
      prefix = 'Missing: ';
      listPart = res.substring(9);
    } else if (res.startsWith('Contains extra: ')) {
      prefix = 'Contains extra: ';
      listPart = res.substring(16);
    } else if (res.startsWith('Diff Strength (')) {
      // E.g., "Diff Strength (Domperidone: 10 mg vs 30 mg, Pantoprazole: 20 mg vs 40 mg)"
      prefix = 'Diff Strength (';
      listPart = res.substring(15, res.length - 1);
      const parts = listPart.split(',').map(x => x.trim()).filter(Boolean);
      parts.sort();
      return prefix + parts.join(', ') + ')';
    }
    const parts = listPart.split(',').map(x => x.trim()).filter(Boolean);
    parts.sort();
    res = prefix + parts.join(', ');
  }
  return res;
}

function normalizeDetails(details) {
  if (typeof details !== 'string') return details;
  if (details.includes('vs')) {
    return details.split(',').map(s => s.trim()).sort().join(', ');
  }
  return details;
}

function walk(node) {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(walk);
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'generated_at' || k === 'timestamp' || k === 'report_generated_at') continue;
      if (k === 'details') {
        out[k] = normalizeDetails(walk(v));
      } else {
        out[k] = walk(v);
      }
    }
    return out;
  }
  return scrubString(node);
}

export const normalize = walk;
