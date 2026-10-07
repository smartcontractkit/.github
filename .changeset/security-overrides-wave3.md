---
"dot-github": patch
---

Bump transitive dependencies via pnpm overrides to remediate Dependabot advisories:

- shell-quote 1.11.0 — GHSA-pqg4-j6r4-53mv, CVE-2026-102422 (quote() command injection)
- vite 7.3.7 — GHSA-fx2h-pf6j-xcff, GHSA-p9ff-h696-f583, GHSA-v2wj-q39q-566r (server.fs.deny bypasses, dev server WebSocket file read)
- undici 6.29.0 — GHSA-vxpw-j846-p89q, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8 (WebSocket DoS)
- form-data 4.0.6 — GHSA-hmw2-7cc7-3qxx, CVE-2026-12143 (CRLF injection in multipart)
- @graphql-tools/utils 12.0.1 — GHSA-7mx3-vvmw-hjmv (mergeDeep prototype pollution)
- @fastify/busboy 3.2.2 — GHSA-x8mw-p69m-v3mx, CVE-2026-19481 (prototype-named multipart header DoS)
- http-cache-semantics 4.3.0 — GHSA-ch52-4w7c-c8xp, CVE-2026-93748 (cross-user cached response disclosure)
- source-map-js 1.2.2 — GHSA-68fv-2mgg-jv7q, CVE-2026-93749 (event-loop DoS via section offsets)
- picomatch 4.0.7 — GHSA-c2c7-rcm5-vvqj (ReDoS via extglob quantifiers)

Fixes DX-5556, DX-4463, DX-4458, DX-3679, DX-3677, DX-4480, DX-3434, DX-3433, DX-5543, DX-5542, DX-5541, DX-5546, DX-3573
