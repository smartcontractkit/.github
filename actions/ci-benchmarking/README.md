# benchmark-action

Initially developed in https://github.com/patrickhuie19/benchmark-action/blob/main/README.md.

A reusable and continuous benchmarking action for go code validating PRs and commit history. 

This action uses https://github.com/benchmark-action/github-action-benchmark/blob/master/README.md

github-action-benchmark works as follows:

```mermaid
graph TD
    A[Checkout Code] --> B[Setup Go Environment]
    B --> C[Run Go Benchmark]
    C -->|output.txt| D[Download Previous Benchmark Data]
    D --> E[Run github-action-benchmark]
    E -->|Extract and Update Result| F[Compare with Previous Data]
    F -->|Performance Regression Detected| G[Alert: Fail Workflow]
    F -->|No Regression| H[No Alert]
    E -->|Update GitHub Pages| I[Deploy to GitHub Pages]
    G --> J[Commit Comment Alert]
    H --> K[No Comment]
    I --> L[Updated GitHub Pages with Benchmark Data]
    J --> M[Notify Performance Regression]
```

Diving deeper into the inputs/outputs for the benchmarking action:

```mermaid
graph TD
    A[go test -bench 'BenchmarkXxxx'] -->|Generate Benchmark Data: Output.txt| B[GitHub Action Benchmark]
    C[Previous GitHub Action Benchmark JSON Data] --> B
    B --> F[Benchmark analysis results]
    F -->|Update| D[GitHub Pages: Display Time Series Results]
    F -->|Generate Alert| E[Commit Alert: Notify Performance Changes]
    F -->|Store Historical Data| C
```

This gives us almost everything we need, with one caveat. The standard usage of this action makes working with PRs untenable, since benchmarking data from feature work can pollute the historical data store that future feature work will be compared against. To work around this, we won't update the historical data store for PRs, only for merges. 

To reuse this action across repos, we offer consumers the following inputs:
- A list of benchmarks to run, specified either in the PR description by developers with the format `\nBENCHMARKS: BenchmarkOne, BenchmarkTwo` or as a comma seperated list of Benchmark names
- A flag to opt-in to using Github Pages, which requires a one-time setup burden from a contributor with write access
- An input to set which branch github pages is setup for in the consumer repo
- A list of branches that this action is valid for

Benchmarking requires historical data. Historical data requires continuous benchmark analyses, which will may increase github spend per merge for the additional compute. PR developers may experience CI latency.


## Example Usage
```
name: Run Benchmarks

on:
  push:
    branches:
      - main  # Specify the branch(es) for which the action runs on merge
  pull_request:
    branches:
      - main  # Specify the branch(es) for which the action runs on PR

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Run Go Benchmark Action
        uses: patrickhuie19/go-benchmark-action@v1
        with:
          benchmarks-pr: 'from-pr'  # Use benchmarks specified in PR, or default benchmarks
          benchmarks-merge: 'BenchmarkAdd' # Default list of benchmarks to run on merges
          trigger-branches: 'main,dev'  # Comma-separated list of branches for merging
          use-gh-pages: 'true'  # Enable or disable GitHub Pages
          github-token: ${{ secrets.GITHUB_TOKEN }}  # Use the built-in GitHub token
          gh-pages-branch: 'gh-pages'  # GitHub Pages branch (if use-gh-pages is true)
          alert-comment-cc-users: '@patrickhuie19'
```

## Open Questions
- How to display analysis data for PRs?
- How to get reproducible environments to ensure precision of results over time?