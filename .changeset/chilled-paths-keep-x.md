---
"changed-modules-go": patch
"changed-roots": patch
---

fix: only strip a literal "./" prefix when normalizing paths

The prefix-stripping regex had an unescaped dot, so it matched any single character followed
by a slash. A module under a single-character top-level directory, such as `x/config`, was
reported as `config`, and consumers received a module directory no directory holds.
