# wait-for-checks

A GitHub Action that waits for specified check runs to complete successfully on
a given commit SHA. This is useful for creating dependencies between workflows
or ensuring certain checks pass before proceeding with subsequent steps.

## Features

- ✅ Wait for multiple check runs using regex patterns
- ⏱️ Configurable timeout and polling intervals
- 🎯 Flexible handling of skipped checks
- 🔄 Polls GitHub's Check Runs API until all matching checks succeed
- 🚫 Fails fast when any matching check fails

## Usage

### Basic Example

```yaml
- name: Wait for CI checks
  uses: ./.github/actions/wait-for-checks
  with:
    check-patterns: |
      ^CI /.*
      ^Build.*
    timeout-seconds: 600
    interval-seconds: 30
```

### Advanced Example with Skip Handling

```yaml
- name: Wait for required checks
  uses: ./.github/actions/wait-for-checks
  with:
    check-patterns: "lint|test|build"
    timeout-seconds: 900
    interval-seconds: 15
    ref: ${{ github.event.pull_request.head.sha }}
    skip-handling: treat-as-success
```

## Inputs

| Input              | Description                                                                       | Required | Default             |
| ------------------ | --------------------------------------------------------------------------------- | -------- | ------------------- |
| `check-patterns`   | Comma or newline separated list of regex patterns for check run names             | ✅ Yes   | -                   |
| `timeout-seconds`  | Maximum time to wait in seconds                                                   | ❌ No    | `300`               |
| `interval-seconds` | Polling interval in seconds                                                       | ❌ No    | `15`                |
| `ref`              | Git ref (SHA) to inspect. Defaults to current commit SHA                          | ❌ No    | `${{ github.sha }}` |
| `skip-handling`    | How to handle skipped checks: `ignore`, `treat-as-success`, or `treat-as-failure` | ❌ No    | `ignore`            |

### Pattern Matching

The `check-patterns` input accepts regex patterns that match against check run
names. Multiple patterns can be provided:

- **Newline separated**: Each pattern on a new line
- **Comma separated**: Patterns separated by commas
- **Regex syntax**: Full regex support (e.g., `^CI /.*`, `test|lint`,
  `build-\d+`)

### Skip Handling Options

- **`ignore`** (default): Skipped checks are ignored, and the action waits for
  non-skipped runs
- **`treat-as-success`**: Skipped checks are treated as successful
- **`treat-as-failure`**: Skipped checks cause the action to fail

## Behavior

1. The action polls the GitHub Check Runs API at the specified interval
2. For each pattern, it finds all matching check runs
3. It waits until all matching checks are:
   - ✅ Completed (not in progress)
   - ✅ Concluded with "success" (or handled according to skip-handling)
4. If any check fails (conclusion is not "success"), the action fails
   immediately
5. If the timeout is reached before all checks complete, the action fails

## Examples

### Wait for CI Workflows

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  wait-for-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Wait for all CI checks
        uses: ./.github/actions/wait-for-checks
        with:
          check-patterns: |
            ^CI /
            ^Lint
            ^Test
          timeout-seconds: 1800
```

### Wait for Specific Tests

```yaml
- name: Wait for integration tests
  uses: ./.github/actions/wait-for-checks
  with:
    check-patterns: "integration-test-.*"
    timeout-seconds: 600
    interval-seconds: 20
    skip-handling: treat-as-success
```

### Wait for Cross-Repository Checks

```yaml
- name: Wait for checks on PR head
  uses: ./.github/actions/wait-for-checks
  with:
    check-patterns: "build|test"
    ref: ${{ github.event.pull_request.head.sha }}
    timeout-seconds: 900
```

## Error Handling

The action will exit with a failure status (exit code 1) if:

- ❌ Any matching check run concludes with a non-success status
- ❌ The timeout is reached before all checks complete
- ❌ Invalid inputs are provided
- ❌ The GitHub API returns an error

## Requirements

- GitHub token is automatically provided by the GitHub Actions environment
- The action runs in a Docker container (built from the included Dockerfile)
- Requires internet access to call the GitHub API

## Development

This action is written in Go and uses the GitHub Check Runs API to monitor check
statuses.

### Local Testing

```bash
cd actions/wait-for-checks
docker build -t wait-for-checks .
docker run --rm \
  -e GITHUB_TOKEN=<your-token> \
  -e GITHUB_REPOSITORY=owner/repo \
  -e GITHUB_SHA=<commit-sha> \
  -e INPUT_CHECK_PATTERNS="test|lint" \
  -e INPUT_TIMEOUT_SECONDS=300 \
  -e INPUT_INTERVAL_SECONDS=15 \
  wait-for-checks
```

## License

See [LICENSE](LICENSE) file for details.
