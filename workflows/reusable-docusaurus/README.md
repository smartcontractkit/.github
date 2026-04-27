# Reusable Docusaurus

Build and deploy Docusaurus documentation to GitHub Pages.

This workflow is reusable and can be called from other workflows. It runs one
job:

- checkout,
- setup Node.js
- build (which validates the docs),
- upload pages artifact
- and conditionally deploy (only on push to main).

## Usage

```yaml
jobs:
  docusaurus:
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-docusaurus.yml@ref
    with:
      build-command: pnpm -C ./docs run build
      build-output-directory: ./docs/build
      package-json-directory: ./docs
```
