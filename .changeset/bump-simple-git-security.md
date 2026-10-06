---
"go-mod-validator": patch
"go-conditional-tests": patch
---

fix: bump simple-git to ^4.0.2 to resolve GHSA-x6jw-m9v5-85vh (CVE-2026-102828) and GHSA-v5rq-49vh-5v5c (CVE-2026-102829). simple-git is a devDependency used only by local fixture tooling; no runtime behavior changes.
