---
"go-conditional-tests": minor
"go-mod-validator": minor
"update-action-versions": minor
---

Replaced `ts-node` with `tsx` and made `go-conditional-tests`, `go-mod-validator`, and `update-action-versions` ESM packages (`"type": "module"`); their bundled CJS entrypoints are renamed `dist/index.cjs` (`out/index.cjs` for `update-action-versions`) and `action.yml` `main` paths are updated accordingly. Enabled `verbatimModuleSyntax` and `noUncheckedIndexedAccess` in `tsconfig.base.json`; ~50 reviewed null-handling guards now fail fast with clear errors on malformed input instead of propagating `undefined`.
