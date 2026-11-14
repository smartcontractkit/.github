#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
WASM="$ROOT/wasm"

mkdir -p "$DIST"

cd "$WASM"
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$DIST/lockfile.wasm" .

GOROOT="$(go env GOROOT)"
WASM_EXEC="$GOROOT/lib/wasm/wasm_exec.js"
if [[ ! -f "$WASM_EXEC" ]]; then
  WASM_EXEC="$GOROOT/misc/wasm/wasm_exec.js"
fi
if [[ ! -f "$WASM_EXEC" ]]; then
  echo "Unable to find wasm_exec.js under $GOROOT" >&2
  exit 1
fi
cp "$WASM_EXEC" "$DIST/wasm_exec.js"

echo "Built $DIST/lockfile.wasm and $DIST/wasm_exec.js"
