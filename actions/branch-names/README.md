# branch-names

Copy/drop-in replacement for the defunct
[tj-actions/branch-names](https://github.com/tj-actions/branch-names) (Apache
2.0 licensed).

<!-- toc -->

- [branch-names](#branch-names)
  - [Features](#features)
  - [Usage](#usage)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Events](#events)
    - [Push](#push)
    - [Pull Request](#pull-request)
    - [Tag](#tag)

<!-- Regenerate with "pre-commit run -a markdown-toc" -->

<!-- tocstop -->

## Features

- Retrieve the current branch name without any prefix. (e.g. `'refs/heads/main'`
  -> `'main'`)
- Retrieve the current tag with an option to strip the prefix (e.g. `v0.0.1` ->
  `v` -> `0.0.1`)
- Detect actions triggered by non default branches
- Detect actions triggered by the default branch
- Supports all valid
  [git branch names](https://wincent.com/wiki/Legal_Git_branch_names)

## Usage

```yaml
---
steps:
  - name: Get branch names.
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@<ref>

  - name: Running on the default branch.
    if: steps.branch-names.outputs.is_default == 'true'
    run: |
      echo "Running on default: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on default: main"

  - name: Running on a pull request branch.
    if: steps.branch-names.outputs.is_default == 'false'
    run: |
      echo "Running on pr: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on pr: feature/test"

  - name: Running on a pull request branch.
    if: steps.branch-names.outputs.is_default == 'false'
    run: |
      echo "Base branch: ${{ steps.branch-names.outputs.base_ref_branch }}"
    # Outputs: "Base branch: main"

  - name: Running on any event.
    run: |
      echo "Default branch: ${{ steps.branch-names.outputs.default_branch }}"
    # Outputs: "Default branch: main"
```

## Inputs

```yaml
- uses: smartcontractkit/.github/actions/branch-names@<ref>
  id: branch-names
  with:
    # The prefix that should be stripped from the tag
    # e.g `v` -> with a tag `v0.0.1` -> returns
    # `0.0.1`
    # Type: string
    strip_tag_prefix: ""
```

## Outputs

| Output            | Type   | Description                                                                 |
| ----------------- | ------ | --------------------------------------------------------------------------- |
| `base_ref_branch` | string | The target branch of a pull request or tag e.g `main`                       |
| `current_branch`  | string | The current branch name regardless of event_type e.g `main`, `feature/test` |
| `default_branch`  | string | The default branch name e.g `main` OR `master`                              |
| `head_ref_branch` | string | The source branch of a pull request e.g `feature/test`                      |
| `is_default`      | string | Returns `"true"` if the current branch is the default else `"false"`        |
| `is_tag`          | string | Returns `"true"` if the current branch is a tag else `"false"`              |
| `ref_branch`      | string | The branch that triggered the workflow run. e.g `1/merge`, `main`           |
| `tag`             | string | The tag that triggered the workflow run. e.g `v0.0.1`, `0.0.1`              |

## Events

### Push

```yaml
on:
  push:
    branches:
      - main
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@<ref>

  - name: Current branch names
    run: |
      echo "${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "main" the branch that triggered the push event.

  - name: Running on the default branch.
    if: steps.branch-names.outputs.is_default == 'true'
    run: |
      echo "Running on default: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on default: main".

  - name: Running on the default branch (i.e non tag based branch).
    if:
      steps.branch-names.outputs.is_tag == 'false' &&
      steps.branch-names.outputs.is_default == 'true'
    run: |
      echo "Running on branch: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on branch: main".

  - name: Get Ref brach name
    run: |
      echo "${{ steps.branch-names.outputs.ref_branch }}"
    #  Outputs: "main"

  - name: Default branch name
    run: |
      echo "${{ steps.branch-names.outputs.default_branch }}"
    # Outputs: "main" the default branch.
```

### Pull Request

```yaml
on:
  pull_request:
    branches:
      - main
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@<ref>

  - name: Current branch names
    run: |
      echo "${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "feature/test" current PR branch.

  - name: Running on a non tag based branch and a PR branch.
    if: steps.branch-names.outputs.is_default == 'false'
    run: |
      echo "Running on branch: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on branch: feature/test".

  - name: Running on a pull request (i.e non tag based branch).
    if:
      steps.branch-names.outputs.is_tag == 'false' &&
      steps.branch-names.outputs.is_default == 'false'
    run: |
      echo "Running on branch: ${{ steps.branch-names.outputs.current_branch }}"
    # Outputs: "Running on branch: feature/test".

  - name: Get Ref branch name
    run: |
      echo "${{ steps.branch-names.outputs.ref_branch }}"
    #  Outputs: "1/merge"

  - name: Get Head Ref branch names (i.e The current pull request branch)
    run: |
      echo "${{ steps.branch-names.outputs.head_ref_branch }}"
    # Outputs: "feature/test" current PR branch.

  - name: Get Base Ref branch names (i.e The target of a pull request.)
    run: |
      echo "${{ steps.branch-names.outputs.base_ref_branch }}"
    # Outputs: "main".

  - name: Default branch names
    run: |
      echo "${{ steps.branch-names.outputs.default_branch }}"
    # Outputs: "main" the default branch.
```

### Tag

```yaml
on:
  push:
    tags:
      - "*"
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@<ref>
    with:
      strip_tag_prefix: v # Optionally strip the leading `v` from the tag.

  - name: Running on a tag branch.
    if: steps.branch-names.outputs.is_tag == 'true'
    run: |
      echo "Running on: ${{ steps.branch-names.outputs.tag }}"
    # Outputs: "Running on: 0.0.1".

  - name: Get the current tag
    if: steps.branch-names.outputs.is_tag == 'true' # Replaces: startsWith(github.ref, 'refs/tags/')
    run: |
      echo "${{ steps.branch-names.outputs.tag }}"
    # Outputs: "0.0.1"
```
