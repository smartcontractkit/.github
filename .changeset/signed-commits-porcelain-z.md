---
"changesets-signed-commits": patch
---

`commitAll` now reads git status with `--porcelain=v1 -z` (NUL-delimited) instead of the line-based format. The line format C-quotes paths containing spaces or special characters (e.g. `?? "new dir/file.txt"`), and those quoted strings failed `readFileSync`, so such files were skipped from the signed commit. With `-z` paths are emitted raw and unquoted, so every readable file is committed regardless of its name. The skip-with-warning fallback remains only for genuinely unreadable entries (directories, broken symlinks). Rename parsing (`original -> new`) is unchanged.
