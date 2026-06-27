# Project: Medicine Substitute Portal

## Architecture
A premium, highly interactive dynamic mobile-first web portal built with **React + Vite + Tailwind CSS v3** directly at the root level of the workspace. It is hosted as a static site on Cloudflare Pages.
All search, parsing, composition comparison, and sorting logic is ported from the original Python script into client-side JavaScript.
If CORS prevents direct browser calls to the Truemeds API, a serverless Cloudflare Pages Function is implemented under `/functions/` as an API proxy.

Key Specifications:
- **Framework & Build Stack**: React, bundled with Vite, styled using Tailwind CSS v3 (configurations placed directly at the root level of the workspace).
- **Mobile-First Design**: Highly responsive, touch-friendly UI. Mobile view uses card layouts or collapsing accordions instead of wide tables.
- **Search History**: User's recent search queries are persisted in browser's `localStorage` and displayed in a "Recent Searches" panel/sidebar. Clicking a past query instantly runs/reloads the search results.
- **URL Search Parameters**: The application detects and parses URL parameters (e.g. `?search=ecosprin` or `?q=ecosprin`) on mount. If present, it automatically triggers a search for that query.
- **API Proxy worker (`functions/api/search.js`)**:
  - Always forces header rotation to prevent rate limiting: picks a random pairing of User-Agent and client hint headers from a predefined pool for every upstream request. Does NOT pass through client's incoming `user-agent` or `sec-ch-ua` headers.
  - Forwards the client's `Accept-Language` header if present.
- **Pilot Data**: Converted JSON reports are stored under `/public/data/` and are used ONLY as offline test fixtures and quick-click demo examples on the landing page.
- **Dynamic Search Engine**: The core search bar executes a fully dynamic client-side engine that performs live API queries, parses the compositions, queries salt alternatives, runs comparison logic in JS, and renders the results on the fly for *any* search query.

The portal consists of:
- **Root Level (React/Vite Root)**:
  - **index.html**: Main HTML entry point.
  - **package.json**: Project dependencies.
  - **vite.config.js**: Vite configuration.
  - **tailwind.config.js** and **postcss.config.js**: Styling configurations.
  - **src/main.jsx**: Entry point for React.
  - **src/App.jsx**: Main React component containing layout, search state, recent searches, results rendering (using mobile-first responsiveness), and interactive animations. Parses URL parameters on mount.
  - **src/js/substitute-finder.js**: Ported JS comparison engine.
  - **src/index.css**: CSS base entry importing Tailwind.
  - **src/components/**: React modular UI components.
  - **public/data/**: Converted JSON report files.
  - **src/tests/**: Test suite utilizing Vitest/Jest and React Testing Library. Includes dynamic parity tests parsing Python Markdown reports to verify JS engine correctness, integration tests verifying URL search parameters triggers, and Worker proxy tests.
- **functions/api/search.js**: Cloudflare Pages serverless function proxying requests with dynamic forced header rotation.

Documentation:
- **README.md** (workspace root): Explains React/Vite structure, UI components, tests, proxy configs, LocalStorage schema, UX wireframes, and deployment steps.
- **python/README.md**: Explains Python CLI usage, matching algorithms, probiotic regex parsing, and execution commands.
- **python/**: Isolated subfolder containing the original `substitute_finder.py` and `reports/`.

## Final Delivery Gate
Completion is subject to a final Opus code audit. We must deliver a complete package containing:
1. Complete list of all files created or modified.
2. Content of primary files (`App.jsx`, `substitute-finder.js`, `index.css`, component files, worker scripts, and test runners).
3. Complete console log output of a successful run of all unit, integration, parity, and worker tests.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Set up Project Architecture and Test Infra Plan | Define codebase layout, design interface specs, and design testing strategy | None | DONE |
| M2 | E2E Testing Track - Build Test Suite | Create a robust requirement-driven E2E/integration testing suite for React at root level. Setup dynamic parity tests, URL parameter tests, and Worker integration tests | M1 | DONE |
| M3 | Implementation Track - Base Setup, Porting Logic & Core Search | Set up React+Vite+Tailwind, port comparison logic, implement search core, URL parameter parsing | M1 | DONE |
| M4 | Implementation Track - Match Categories & Filters | Implement exact/different-strength/partial match mobile cards and filter buttons | M3 | DONE |
| M5 | Implementation Track - Price Savings & Swap Diagrams | Design and implement the visual price savings dashboard and interactive swap diagrams | M4 | DONE |
| M6 | Implementation Track - Final Integration & Verification | Pass 100% E2E tests, implement Worker header fingerprinting/rotation, write README documentation, and run final checks | M2, M5 | IN_PROGRESS |

## Interface Contracts
### Web Application Frontend ↔ Ported Search Engine
- **Module**: `/src/js/substitute-finder.js`
- **Method**: `findSubstitutes(medicineData)`
- **Input**: Raw JSON data returned from Truemeds API (`getSearchResult`).
- **Output**: JSON payload matching comparison tables structure.
- **JSON Schema**:
  ```json
  {
    "queried_medicine": {
      "name": "string",
      "price": 0.0,
      "mrp": 0.0,
      "unit_price": 0.0,
      "units": 0,
      "ingredients": ["string"]
    },
    "recommendations": [
      {
        "category": "string",
        "brand": "string",
        "mrp": 0.0,
        "price": 0.0,
        "unit_price": 0.0,
        "savings_percent": 0.0,
        "link": "string",
        "details": "string"
      }
    ],
    "alternatives": {
      "exact": [...],
      "different_strength": [...],
      "partial": [...]
    }
  }
  ```

## Code Layout
All React-related assets and files are located at the root of the workspace `/Users/nikunjbhartia/truemeds/`.
- `/Users/nikunjbhartia/truemeds/index.html`
- `/Users/nikunjbhartia/truemeds/package.json`
- `/Users/nikunjbhartia/truemeds/vite.config.js`
- `/Users/nikunjbhartia/truemeds/tailwind.config.js`
- `/Users/nikunjbhartia/truemeds/postcss.config.js`
- `/Users/nikunjbhartia/truemeds/src/main.jsx`
- `/Users/nikunjbhartia/truemeds/src/App.jsx`
- `/Users/nikunjbhartia/truemeds/src/js/substitute-finder.js`
- `/Users/nikunjbhartia/truemeds/public/data/`
- `/Users/nikunjbhartia/truemeds/src/tests/`
- `/Users/nikunjbhartia/truemeds/functions/api/search.js`
- `/Users/nikunjbhartia/truemeds/README.md`
- `/Users/nikunjbhartia/truemeds/python/README.md`
