---
"go-conditional-tests": patch
"go-mod-validator": patch
---

TS config hygiene: dropped unused `experimentalDecorators`/`emitDecoratorMetadata` from `tsconfig.base.json` (no decorators in source), slimmed `libs/jira-tracing/tsconfig.json` to `extends` + project specifics, and removed dead code surfaced by stricter lint severities. No behavior changes; dists rebuilt.
