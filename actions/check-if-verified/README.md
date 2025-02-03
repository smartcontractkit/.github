# check-if-verified

> Checks if a tag or commit has a GPG signature.

## Usage

```
name: Check If Verified Test

on:
  pull_request:
  push:
    tags:
      - "v*"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check PR Commit
        uses: smartcontractkit/.github/actions/check-if-verified@<ref> # tag
        if: ${{ github.event_name == 'pull_request' }}
        with:
          commit: ${{ github.event.pull_request.head.sha }}
          assert: true

      - name: Check Tag
        uses: smartcontractkit/.github/actions/check-if-verified@<ref> # tag
        if: ${{ github.event_name == 'push' && startsWith(github.ref, 'refs/tags/') }}
        with:
          tag: ${{ github.ref_name}}
          assert: true

```
