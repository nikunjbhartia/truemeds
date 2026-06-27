# Python CLI Medicine Substitute Finder

The original, production-grade CLI utility written in Python for fetching and identifying medicine substitutes, matching composition salts, and exporting clean markdown reports.

## Features
- **Composition Analysis**: Normalizes ingredient names and compares them against reference medicine composition.
- **Match Categories**:
  - **Exact Match**: Contains same salts and strengths.
  - **Different Strength**: Same salts, different strengths.
  - **Extra Ingredients**: Reference salts are a subset of candidate salts (extra salts present).
  - **Missing Ingredients**: Candidate salts lack some reference salts.
- **Probiotic Strength Normalization**: Parses complex strength formats for probiotic combinations (e.g. `1 B`, `1.25 Billion Cells`, `15 Billion spores`) to allow precise comparison.
- **Deduplication**: Filters out duplicate medicine codes, keeping only the cheapest pack/variant.

---

## Installation & Setup
Requires Python 3.8+.

```bash
# Navigate to the python directory
cd python

# Run the script directly
python3 substitute_finder.py "<query>"
```

---

## Execution
To generate substitute reports:
```bash
python3 substitute_finder.py "Ecosprin 75"
```
This will fetch suggestions and ingredients from Truemeds API, perform alignment checks, and generate a markdown report under the root directory: `ecosprin_75_tablet_14_substitutes.md`.

---

## Mock/Offline Mode (Tests)
To run the python script using offline mock JSON files (fixtures):
```bash
MOCK_FIXTURE_DIR="ecosprin_75_tablet_14" python3 substitute_finder.py "Ecosprin 75"
```
This forces the script to read payloads from `src/tests/fixtures/api/ecosprin_75_tablet_14/` instead of executing remote network requests.
