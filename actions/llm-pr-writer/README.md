# GitHub LLM PR Writer

This GitHub workflow harnesses the capabilities of Large Language Models (LLMs)
to automate the creation and enhancement of pull request (PR) descriptions.
Designed to streamline the development process, it significantly reduces the
time and effort traditionally required to draft comprehensive PR descriptions,
particularly for extensive changes. By meticulously analyzing the modifications
within a PR, the workflow generates precise, context-rich summaries that
facilitate improved collaboration and review efficiency.

The implementation of this workflow promotes uniformity and depth in PR
descriptions across all contributions. This not only accelerates the review
process but also ensures that maintainers and collaborators can quickly grasp
the essence and intent of changes, fostering a more cohesive and efficient
project development environment.

# Prerequisite

- An OpenAI API key with access to GPT chat completion endpoints. Ask in
  `#ds_ai` if you need an API key.
- SHA of the tag you want to use.

```bash
# if you have cloned the repository, you can find the SHA of the tag by running
git rev-list -n 1 [TAG_NAME]
# otherwise, search for available tags at https://github.com/smartcontractkit/.github
# from branch dropdown -> tags tab -> type in llm-pr-writer
```

# Usage

```yaml
on:
  pull_request:
    types: [opened, reopened, ready_for_review]
  issue_comment:
    # Reply to an existing PR to generate description (commenter requires PR write access)
    # Requires `/gpt-create-pr` commands to invoke
    types: [created]

jobs:
  llm-pr-generator:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      repository-projects: read
    steps:
      - name: Generate PR Description
        uses: smartcontractkit/.github/actions/llm-pr-writer@[SHA] # points to a specific tag (ie. llm-pr-writer@0.5.0)
        with:
          # GitHub token used to fetch the PR diff and create a new PR comment.
          # ${{ secrets.GITHUB_TOKEN }} will be sufficient.
          gh-token: ""
          # OpenAI API Key, used to generate PR descriptions using the GPT model.
          # Needs to have access to the chat-completion endpoints
          # Example: ${{ secrets.OPENAI_API_KEY }}
          openai-api-key: ""
          # OpenAI model to use for PR description generation. Defaults to 'o3-mini-2025-01-31'.
          # Learn more at: https://platform.openai.com/docs/models/overview
          openai-model: ""
          # File paths or patterns to exclude from the diff analysis. Use semicolons (;) to separate multiple paths.
          # Example: 'poetry.lock;artifacts/*'
          # WARNING: Not excluding build artifacts may result in a large diff that may exceed the GPT model's token limit.
          exclude-paths: ""
          # Absolute file path to a markdown or text file to append to the PR message (checklist, etc.)
          # Example: '.github/pull_request_append.md'
          pr-append-file: ""
```

# Usage Scenarios

- Trigger the action by creating a pull request

```yaml
on:
  pull_request:
    types: [opened]
```

- Trigger the action by changing PR status from Draft to Ready for Review

```yaml
on:
  pull_request:
    types: [ready_for_review]
```

- Trigger the action by reopening a closed PR

```yaml
on:
  pull_request:
    types: [reopened]
```

- Trigger the action by committing to the PR

```yaml
on:
  pull_request:
    types: [synchronize]
```

- Trigger by commenting on an existing pull request with `/gpt-create-pr`
  command

```yaml
on:
  issue_comment:
    types: [created]
```

# Tips

### Ignoring PRs from Bots

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      repository-projects: read
    steps:
      - name: Generate PR Description if PR is not from a bot
        if: ${{ !endsWith(github.actor, '[bot]') }}
        uses: smartcontractkit/.github/actions/llm-pr-writer@[SHA] # llm-pr-writer@0.6.0
        with:
          gh-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          openai-model: "o3-mini-2025-01-31"
          exclude-paths: "dbt-home/*;artifacts/*;target/*;poetry.lock"
```
