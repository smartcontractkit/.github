# Spec Delta

## Purpose

Defines the repo's spec-driven planning workflow: the OpenSpec root that holds
plans and specs, and the agent-discoverable workflows that move a change from
idea to archived spec.

## ADDED Requirements

### Requirement: Validated OpenSpec root

The repo root SHALL contain an OpenSpec root — `openspec/config.yaml` with the
spec-driven schema, `openspec/specs/`, and `openspec/changes/` with `archive/` —
that passes `openspec validate`.

#### Scenario: Root structure is present

- **WHEN** a fresh clone of the repo is inspected at the root
- **THEN** `openspec/config.yaml`, `openspec/specs/`, and
  `openspec/changes/archive/` all exist

#### Scenario: Validation passes

- **WHEN** `openspec validate` runs at the repo root
- **THEN** it exits successfully

### Requirement: Agent-discoverable planning workflows

The six core OpenSpec workflow skills (explore, propose, update-change,
apply-change, sync-specs, archive-change) SHALL be installed in the shared
`.agents/skills/` folder, so agent tools that read the shared folder discover
them without per-tool duplicates.

#### Scenario: Shared skills are installed

- **WHEN** `.agents/skills/` is inspected
- **THEN** one directory per core workflow exists, each containing a `SKILL.md`
  with a description

#### Scenario: No per-tool duplicates

- **WHEN** the repo is inspected for a second copy of the workflow skills (e.g.
  `.opencode/skills/openspec-*`)
- **THEN** none exists, and the shared `.agents/skills/` copy is the single
  source

### Requirement: Planning artifacts are versioned

In-flight changes SHALL live under `openspec/changes/<change-name>/` as plain
markdown artifacts (proposal, spec delta, design when needed, tasks) committed
to the repo alongside the code they describe.

#### Scenario: A change folder is reviewable in git

- **WHEN** a change is proposed
- **THEN** its folder and artifacts are untracked or committed files under
  `openspec/changes/`, reviewable like any other diff

#### Scenario: Finished changes are archived

- **WHEN** every task in a change's `tasks.md` is checked and the change is
  archived
- **THEN** the folder moves to `openspec/changes/archive/<date>-<change-name>/`
  and its delta has updated `openspec/specs/`
