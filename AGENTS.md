# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is `@tockawa/nfc-pcsc` — a Node.js TypeScript library for NFC tag/card interaction via PC/SC readers. It wraps the `@pokusew/pcsclite` native C++ addon.

### Node version

**Must use Node 18** (not 20+). The `@pokusew/pcsclite` native addon uses `nan`, which is incompatible with the V8 API in Node 20+. Node 18 is set as the nvm default.

### System dependencies

`libpcsclite-dev` is required on Linux for the native addon to compile during `npm install`. The update script handles this.

### Build

```
npm run build
```

Compiles TypeScript to CommonJS (`dist/commonjs/`) and ESM (`dist/esm/`), then renames `.js` → `.mjs` in the ESM output. Type declarations go to `dist/types/`.

### Type checking

```
npx tsc -p tsconfig.commonjs.json --noEmit
```

No dedicated lint or test commands exist in this repo (no eslint, no test framework configured).

### Running the library (hello world)

The library requires the `pcscd` daemon to establish a PC/SC context. In cloud VMs without NFC hardware:

1. Start `pcscd`: `sudo pcscd --auto-exit &`
2. Run with `sudo` so the process can connect to the daemon:
   ```
   sudo /home/ubuntu/.nvm/versions/node/v18.20.8/bin/node -e "const PCSC = require('./dist/commonjs/src/index.js'); const nfc = new PCSC.default(); nfc.on('reader', r => console.log(r.name)); setTimeout(() => { nfc.close(); }, 3000);"
   ```

The NFC instance will start polling but find no readers (expected without hardware).

### Known issues

- The ESM build output has broken internal import paths (files renamed to `.mjs` but import specifiers inside them are not updated). The CommonJS build works correctly.
- Functional NFC testing (read/write) requires physical NFC reader hardware and cards, which are not available in cloud VMs.
