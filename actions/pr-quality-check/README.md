## PR Quality Check

LLM-powered quality checker for pull requests. It analyzes changed files against
repository-defined natural language rules and posts a single PR comment that is
updated on every commit.

### Key features

- **Rule-driven**: Reads rules from a repository rule config file (path set via
  `quality-config-file`, default `quality_check.yml`).
- **Glob matching**: Robust matching using `glob_match.py` with `*`, `?`, `**`,
  and brace expansion.
- **Context-aware**: For rules marked `requires_context: true`, asks a model
  which additional changed files (diffs) are needed to validate the rule; embeds
  those patches as context. Rules with `requires_context: false` skip this call.
- **Single updatable comment**: Posts/updates one comment per PR, with a footer
  noting the last refresh commit.
- **Configurable models**: Configurable openAI models for context discovery and
  rule analysis.

### How it works (high level)

1. Ensures it runs only on `pull_request*` events with a valid PR number.
2. Loads quality rules from the configured rule config file.
3. Retrieves PR files and patches.
4. Matches changed files against configured glob patterns using `glob_match.py`.
5. For each matched file:
   - Determines status (added/modified/removed/renamed). Renames are treated as
     modified for gating.
   - For rules with `requires_context: true`, discovers per-rule context using
     an LLM (limited to changed files list). Context discovery only runs for
     newly added files; modified/renamed files skip context-required rules.
   - Builds a prompt with: applicable rules (YAML), file path, and its patch;
     optionally embeds context patches.
   - Calls the review model; parses issues/warnings and aggregates counts.
6. Writes a Markdown report and posts/updates a single PR comment.
7. Optionally fails the job if errors are found.
8. Every commit re-triggers the action and updates the comment.

### Inputs

- **gh-token** (required): GitHub token for API access.
- **openai-api-key** (required): OpenAI API key used for LLM calls.
- **openai-model-context** (optional, default: `gpt-5-nano`): Model for context
  discovery.
- **openai-model-review** (optional, default: `gpt-5-mini`): Model for rule
  analysis.
- **quality-config-file** (optional, default: `quality_check.yml`): Path to the
  rule configuration file in the repo. Can be named and located anywhere;
  default is `quality_check.yml`.

- **fail-on-errors** (optional, default: `false`): If `true`, fail the job when
  errors are detected.
- **post-comment** (optional, default: `true`): If `true`, post/update a PR
  comment with results.
- **log-prompts** (optional, default: `false`): If `true`, logs the constructed
  prompts for debugging.

- **analysis-cache-enabled** (optional, default: `true`): Enable per-file
  analysis caching. When enabled, unchanged files reuse cached issues by
  `(file_path, blob_sha)` and a config hash.

- **claude-code-auto-fix-enabled** (optional, default: `false`): Enable Claude
  Code auto-fix. Runs only when fix candidates exist (rules with
  `auto_fix_instructions` are violated).
- **claude-code-gcp-project-id** (optional): GCP Project ID for Vertex
  Anthropic. Required when auto-fix is enabled.
- **claude-code-gcp-service-account-key** (optional): GCP Service Account JSON
  (as a repo secret). Required when auto-fix is enabled.
- **anthropic-model** (optional, default: `claude-sonnet-4@20250514`): Claude
  model used by Claude Code.

### Configuration (rule config file)

#### Implementing the rule config file

- **Location**: Create a rule config file anywhere in your repo and point to it
  via the `quality-config-file` input (default: `quality_check.yml`).
- **Purpose**: Define natural-language quality rules per glob pattern. The
  action matches changed files to patterns and applies the associated rules.
- **Top-level config keys**:

  - `exceptions`: Glob or list of globs to exclude from analysis before rule
    matching.

- **Per-rule options**:
  - `requires_context` (boolean, default: `false`): Whether the rule needs extra
    cross-file context. If `true`, the action makes one LLM call per file+rule
    to determine which changed files (if any) are needed as context. If `false`,
    no context call is made for that rule. IMPORTANT: If `true`, the rule will
    only be applied to newly added files.
  - `enforce_on_new_only` (boolean, default: `false`): If `true`, the rule is
    enforced only on newly added files, not on modified ones.
  - `severity`: `error` or `warning`
  - `auto_fix_instructions` (string, optional): Concise directive for Claude
    Code to attempt a fix when this rule is violated. Presence of this field
    makes violations of the rule eligible for auto-fix.

Example (copy into your rule config file):

```yaml
# Quality Check Rules Configuration
# Files matching any 'exceptions' are ignored before rule matching.

exceptions:
  - "**/migrations/**" # ignore DB migrations
  - "**/*.md" # ignore Markdown
  - "docs/**" # ignore docs folder at repo root

rules:
  "**/*.py":
    - id: "function-docstrings"
      description:
        "All public functions must have docstrings explaining their purpose"
      severity: "warning"
      requires_context: false
    - id: "class-docstrings"
      description:
        "All public classes must have docstrings explaining their purpose and
        usage"
      severity: "warning"
      requires_context: false
      enforce_on_new_only: true

  # You can target multiple directories using brace expansion
  "**/{marts,mart,datamart}/**/*.sql":
    - id: "medallion-architecture"
      description:
        "New mart models should have medallion architecture defined
        (bronze/silver/gold) in a corresponding YAML file"
      severity: "warning"
      requires_context: true

  # General SQL quality
  "**/*.sql":
    - id: "no-select-star"
      description:
        "Avoid using SELECT * at the end of a SQL statement; SELECT * is allowed
        in CTEs/subqueries, but the final SELECT must list columns explicitly"
      severity: "error"
      requires_context: false
```

#### Workflow Setup

Create a workflow file (e.g., `.github/workflows/pr-quality-check.yml`):

```yaml
name: PR Quality Check

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run PR Quality Check
        uses: ./.github/actions/pr-quality-check
        with:
          gh-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          openai-model-context: gpt-5-nano
          openai-model-review: gpt-5-mini
          quality-config-file: path/to/your-rules.yml
          fail-on-errors: false
          post-comment: true
          log-prompts: false
```

#### Tips:

- To apply the same rules to multiple areas, either duplicate the block under
  multiple glob keys or use brace expansion like `"**/*.{py,txt}"` or
  `"**/{models,seeds}/**/*.yml"`.
- Add comments after the quoted glob or field (not inside the quotes).
- Glob matching supports `*`, `?`, `**`, and brace expansion like `{a,b}`.
- `exceptions` accepts a single glob string or a list of globs. Any changed file
  matching an exception is ignored before rule matching.

#### Glob syntax quick guide

- A path "segment" is the text between slashes `/`.
- `*`: matches any characters within a single segment (not `/`).
  - Example: `src/*.py` matches `src/app.py` but not `src/utils/helpers.py`.
- `?`: matches exactly one character within a segment.
  - Example: `config?.yml` matches `config1.yml`, `configA.yml`.
- `**`: matches across directories (zero or more segments).
  - Example: `**/*.sql` matches `models/a.sql` and `dbt/core/models/b/c.sql`.
- `{a,b}`: brace expansion for alternatives.
  - Example: `**/*.{yml,yaml}` matches both `.yml` and `.yaml`.

Notes:

- Quote patterns in YAML, e.g., `"**/*.sql"`.
- Paths use `/` separators in the repo regardless of OS.
- `exceptions` are applied before rule matching; files matching an exception are
  skipped entirely.

### Auto-fix with Claude Code

#### What it does

- Aggregates all violations that correspond to rules which define
  `auto_fix_instructions` in your `quality_check.yml` into a single plan, then
  performs one Claude Code run to propose fixes across those files.
- Creates or updates a dedicated PR targeting the original PR's head branch,
  using a stable branch name: `auto-fix/pr-<PR_NUMBER>`.

#### Prerequisites

- Set inputs:
  - `claude-code-auto-fix-enabled: true`
  - `claude-code-gcp-project-id` (set via repo variable in the workflow yml)
  - `claude-code-gcp-service-account-key` (set via repo variable in the workflow
    yml)

#### When it triggers

- Only if the analysis produced fix candidates (i.e., at least one rule with
  `auto_fix_instructions` was violated).
- Fingerprint gating: a stable SHA-256 fingerprint (based on sorted file paths,
  sorted rule IDs, and counts per rule) is compared to the last run. If the
  fingerprint is unchanged, Claude Code is skipped to avoid redundant runs.
- Comment-triggered reruns are not supported in this release.

#### Comments and PRs

- Posts a progress comment: "Auto-fix started with Claude Code (PR incoming)"
  with a list of files/rules targeted and the short commit SHA.
- Creates or updates an auto-fix PR with title:
  `PR Quality Check: Auto-fixes for PR #<number>` and body that includes the
  short SHA and notes about scope.
- Updates the progress comment to link the created/updated PR and appends:
  - `🚀 Auto-fix targeted all issues detected. Based on commit: <shortsha>` when
    coverage is 100%.
  - `⚠️ Auto-fix targeted only rules with auto_fix_instructions in quality_check.yml. Based on commit: <shortsha>`
    otherwise.
- The comment embeds the fingerprint in a hidden HTML marker
  (`<!-- pr-qc-fix-fingerprint: <hash> -->`) to drive gating.

#### Writing rules with auto-fix

Add `auto_fix_instructions` to rules you want Claude to attempt fixing:

```yaml
"**/*.txt":
  - id: "no-fruits-mentioned"
    description: "Text files must not mention fruits"
    severity: "warning"
    requires_context: false
    auto_fix_instructions:
      "Remove or replace any fruit mentions without altering meaning."
```

#### Security and cleanup

- Temporary credentials, prompt files, and `.qc/fix_candidates.json` are removed
  before staging to avoid committing sensitive artifacts.

### Comment behavior

- A single PR comment is created and then updated on every commit.
- Footer includes: “Comment updated with every commit (last refresh:
  <short SHA>).”

### Implementation details

- Changed files and patches are fetched via GitHub REST API using `requests`
  with retries and pagination (endpoints:
  `GET /repos/{owner}/{repo}/pulls/{number}`,
  `GET /repos/{owner}/{repo}/pulls/{number}/files`).
- For renamed files, `previous_filename` is logged and rules gate as `modified`.
- When patches are missing for a large file, the action notes that no patch is
  available.
- Comments are posted/updated via
  `POST/PATCH /repos/{owner}/{repo}/issues/{number}/comments`.

### Troubleshooting

- Ensure `OPENAI_API_KEY` is set and valid in the repository.
- If no files match patterns, the job reports and optionally posts a skip
  message.
- Set `log-prompts: true` to inspect prompts in logs for debugging.
- The action logs detailed context discovery information, including which rules
  require context, when discovery is skipped, and per-rule results with selected
  files and reasons.

### Limitations

- Currently, if a rule requires context, it will only be applied to newly added
  files (not modified or renamed). This is a current limitation due to the LLM
  receiving code diffs, which might have context missing for modified files.
