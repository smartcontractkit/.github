# Proposal

## Why

Planning for agent-driven work currently happens in ephemeral chat threads:
plans are not versioned, not reviewable by the team, and lost between sessions.
This PR is a proof of concept for spec-driven development with OpenSpec, so
future changes get a reviewable plan (proposal, spec deltas, tasks) committed to
the repo before any code is written.

## What Changes

- Add an `openspec/` root at the repo root: `config.yaml` (schema: spec-driven),
  empty `specs/`, and `changes/` with `archive/`.
- Add the six core OpenSpec workflow skills (explore, propose, update-change,
  apply-change, sync-specs, archive-change) to the shared `.agents/skills/`
  folder, so every agent tool the team uses (OpenCode, Claude Code, Codex,
  Cursor, ...) discovers them from one location.
- No runtime code changes: nothing in `actions/`, `apps/`, `libs/`, or CI is
  touched by this change.

## Capabilities

### New Capabilities

- `openspec-workflow`: The repo's spec-driven planning workflow — the OpenSpec
  root, its structure, and the agent-discoverable workflows that move a change
  from explore to archive.

### Modified Capabilities

<!-- None: openspec/specs/ is empty; no existing capabilities to modify. -->

## Impact

- New files only: `openspec/**` and `.agents/skills/openspec-*/`.
- No dependencies, APIs, or published packages affected.
- Out of scope (deliberately, as follow-up changes if the PoC is adopted): team
  process documentation (CONTRIBUTING/PR-template guidance for reviewing change
  folders), a CI job running `openspec validate`, and running a real feature
  change through the full loop.
- Assumption: `.agents/skills/` alone (no `.opencode/` duplicates) is sufficient
  delivery, since OpenCode discovers `.agents/skills/` as a project
  compatibility source.
