# Get PR Labels

Will get the labels on a PR, for a `pull_request` event or a `merge_group`
event. All other events will return nothing.

## Inputs

- `pr-number` (optional) - The PRs number
  - If not included, it will determine the PR number from the Github event
    context (pull requests), or the branch name (merge group).
- `check-label` (optional) - A label to check existence for.
  - Will check if this label exists on the PR.
- `check-type` (optional - defaults to `current`) - The source to check for the
  above label's existence.
  - There are three possible sources: `event`, `current`, `all`. See below for
    more context.
- `skip-merge-group` (optional boolean - defaults to `false`) - Whether to skip
  processing for `merge_group` events.

## Outputs

- `check-label-found` - `true/false` if the `check-label` input was found in the
  list of labels from the `check-type` source
- `event-labels` - a CSV of labels from the event which dispatched the job.
  - Event labels are the labels on the PR at the time of the `pull_request`
    event.
  - ie. Opening a PR, then adding a label means the event payload will have not
    have the label.
  - ie. Removing a label, then retrying a workflow. The workflow will have the
    same payload as before, where the label exists.
- `current-labels` - a CSV of the labels on the PR at the time the action was
  executed.
  - These labels are fetched from the Github API and are therefore up-to-date
    when requested.
- `all-labels` - a CSV combining the event and current labels (duplicates
  removed).

## Usage

```
name: Get PR Labels Example

on:
  pull_request:
  merge_group:


jobs:
  example:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - name: Get PR Labels
        id: get-pr-labels
        uses: smartcontractkit/.github/actions/get-pr-labels@<tag>
        with:
          check-label: 'documentation'
          check-type: 'current'

      - name: Outputs
        run: |
          # Checked for the 'documentation' label on the current pr labels
          echo "Check Label: ${{ steps.get-pr-labels.outputs.check-label-found }}"

          echo "PR Labels: ${{ steps.get-pr-labels.outputs.event-labels }}"
          echo "Current PR Labels: ${{ steps.get-pr-labels.outputs.current-labels }}"
          echo "All Labels: ${{ steps.get-pr-labels.outputs.all-labels }}"
```
