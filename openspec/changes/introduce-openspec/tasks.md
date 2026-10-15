# Tasks

## 1. OpenSpec root

- [x] 1.1 Commit the staged `openspec/` root (`config.yaml` with spec-driven
      schema, `specs/`, `changes/` with `archive/`); verify with
      `openspec list --json` reporting the repo root
- [x] 1.2 Verify the root passes `openspec validate` (exit 0) after the commit
      lands

## 2. Shared workflow skills

- [x] 2.1 Commit the staged `.agents/skills/openspec-*/` skills; verify all six
      `SKILL.md` files exist and no `.opencode/` duplicate copy remains
      (`test ! -d .opencode`)

## 3. This change's artifacts

- [x] 3.1 Commit `openspec/changes/introduce-openspec/` (proposal, delta spec,
      design, tasks) together with the scaffolding; verify the folder appears in
      the PR diff

## 4. Integration checks

- [x] 4.1 Open the PR from `introduce-open-spec` and verify the diff contains
      only `openspec/**` and `.agents/skills/**` paths
- [ ] 4.2 In a fresh agent session, verify an OpenSpec workflow triggers
      naturally (e.g. ask to propose a change and see the propose workflow
      engage)

## Workflow follow-up

- After the PR merges, archive this change: the delta updates
  `openspec/specs/openspec-workflow/` and the folder moves to
  `openspec/changes/archive/<date>-introduce-openspec/`.
- Team decisions deferred to review: whether to add `/opsx-*` OpenCode commands
  (`openspec init --tools opencode`) and a CI `openspec validate` job.
