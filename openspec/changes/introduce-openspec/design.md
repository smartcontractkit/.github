# Design

## Context

See proposal.md - Why. The repo had no planning scaffolding; agent tools each
keep their own instruction files, and no shared plan artifacts exist. The
scaffolding had already been generated with `openspec init` on the
`introduce-open-spec` branch and is staged; this change documents the decisions
behind what landed.

## Goals / Non-Goals

**Goals**

- One shared installation of the workflow skills, usable by every agent tool the
  team uses.
- Minimal diff: scaffolding only, no runtime code.

**Non-Goals**

- Typed `/opsx-*` slash commands for OpenCode.
- CI enforcement (`openspec validate` job), team process docs, or running a real
  feature through the loop — follow-up changes if the PoC is adopted.

## Decisions

**1. Shared `.agents/skills/` only; no `.opencode/` duplicates.**

OpenSpec's `agents` tool installs to the shared `.agents/skills/` folder, which
OpenCode discovers as a project compatibility source (as do Claude Code, Codex,
and Cursor). Installing the `opencode` tool additionally writes near-identical
skill copies to `.opencode/skills/` plus `/opsx-*` command files — the only
content difference is one referenced command name.

- Alternative: keep `.opencode/` for typed `/opsx-*` entry points — rejected as
  duplication for a PoC; skills and commands are functionally identical, and
  `openspec init --tools opencode` re-adds them in seconds if the team wants
  them.

**2. Default spec-driven schema, core profile.**

The extended workflows (verify, bulk-archive, onboard) stay uninstalled; the
core six cover the full loop. The `.agents/skills/.openspec-target` marker
records the `agents` tool so `openspec update` refreshes only that location.

## Risks / Trade-offs

- [Skill files drift from the installed OpenSpec version] → `openspec update`
  refreshes them; the marker file keeps the update scoped to `.agents/skills/`.
- [lefthook's prettier pre-commit hook currently fails repo-wide (pnpm refuses
  to run: `pnpm.overrides` in `package.json` is no longer read by the installed
  pnpm)] → commit this markdown-only scaffolding with `--no-verify`; fix the
  pnpm config in a separate change.
- [PoC not adopted by the team] → scaffolding is additive only; a revert removes
  it cleanly.

## Open Questions

None blocking. Whether to add the `/opsx-*` OpenCode commands and a CI validate
job is decided after the team reviews the PoC.
