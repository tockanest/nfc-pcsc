# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is `@tockawa/nfc-pcsc`, a TypeScript NFC library for PC/SC card readers. It wraps the native `@pokusew/pcsclite` C++ addon.

### Node.js version

Node.js 20 is required. The native addon (`@pokusew/pcsclite`) does **not** compile on Node.js 22+ due to removed V8 APIs. The CI tests against Node 14–20.

### System dependencies

On Linux, `libpcsclite-dev` must be installed for the native addon to compile during `npm install`:
```
sudo apt-get install -y libpcsclite1 libpcsclite-dev
```

### Build & type-check

```bash
npm run build          # Compiles CommonJS + ESM + renames .js → .mjs
npx tsc --noEmit -p tsconfig.esm.json   # Type-check only (no lint tool configured)
```

### Testing limitations

- No automated test suite exists (no `npm test` script).
- The `test:basic`, `test:read`, `test:write` scripts require a **physical NFC reader** and card — they cannot run in a headless VM.
- To verify correctness without hardware, use `npm run build` (TypeScript compilation) and load-test the CommonJS output with `node -e "require('./dist/commonjs/src/index.js')"`.

### Known issues

- The ESM build (`dist/esm/`) has import resolution issues (missing `.mjs` extensions in generated imports). The CommonJS build is the primary distribution format.
