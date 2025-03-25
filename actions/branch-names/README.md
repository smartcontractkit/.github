# branch-names

Internally maintained drop-in replacement for
[tj-actions/branch-names](https://github.com/tj-actions/branch-names).

Original author: [tj-actions](https://github.com/tj-actions)

## TOC

- [branch-names](#branch-names)
  - [TOC](#toc)
  - [Features](#features)
  - [Usage](#usage)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Events](#events)
    - [`push*`](#push)
    - [`pull_request*`](#pull_request)
    - [`tag*`](#tag)
  - [License](#license)

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
    uses: smartcontractkit/.github/actions/branch-names@branch-names/1.0.0

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
- uses: smartcontractkit/.github/actions/branch-names@branch-names/1.0.0
  id: branch-names
  with:
    # The prefix that should be
    # stripped from the tag e.g
    # `v` -> with a tag
    # `v0.0.1` -> returns `0.0.1`
    # Type: string
    strip_tag_prefix: ""
```

## Outputs

| OUTPUT                                                                          | TYPE   | DESCRIPTION                                                                     |
| ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| <a name="output_base_ref_branch"></a>[base_ref_branch](#output_base_ref_branch) | string | The target branch of a <br>pull request or tag e.g <br>`main`                   |
| <a name="output_current_branch"></a>[current_branch](#output_current_branch)    | string | The current branch name regardless <br>of event_type e.g `main`, `feature/test` |
| <a name="output_default_branch"></a>[default_branch](#output_default_branch)    | string | The default branch name e.g <br>`main` OR `master`                              |
| <a name="output_head_ref_branch"></a>[head_ref_branch](#output_head_ref_branch) | string | The source branch of a <br>pull request e.g `feature/test`                      |
| <a name="output_is_default"></a>[is_default](#output_is_default)                | string | Returns `"true"` if the current <br>branch is the default else <br>`"false"`.   |
| <a name="output_is_tag"></a>[is_tag](#output_is_tag)                            | string | Returns `"true"` if the current <br>branch is a tag else <br>`"false"`.         |
| <a name="output_ref_branch"></a>[ref_branch](#output_ref_branch)                | string | The branch that triggered the <br>workflow run. e.g `1/merge`, `main`           |
| <a name="output_tag"></a>[tag](#output_tag)                                     | string | The tag that triggered the <br>workflow run. e.g `v0.0.1`, `0.0.1`              |

## Events

### `push*`

```yaml
on:
  push:
    branches:
      - main
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@branch-names/1.0.0

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

### `pull_request*`

```yaml
on:
  pull_request:
    branches:
      - main
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@branch-names/1.0.0

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

### `tag*`

```yaml
on:
  push:
    tags:
      - "*"
---
steps:
  - name: Get branch names
    id: branch-names
    uses: smartcontractkit/.github/actions/branch-names@branch-names/1.0.0
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

## License

- Free software: [MIT license](LICENSE)
