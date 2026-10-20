const test = require("node:test");
const assert = require("node:assert/strict");

const check = require("./check.js");
const {
  classifyFiles,
  globToRegExp,
  missingSections,
  parseSectionSpec,
  splitSections,
} = check;

// infra-k8s pull_request_template.md at origin/main, 2026-10-20.
const INFRA_K8S_TEMPLATE = `## What

<!--
Brief, point form descriptions of what you changed
Also, reference any Jira/Github issues here
-->

## Why

<!--
 Why is this change needed?
-->

## Testing evidence

<!--
Link the lower-environment PRs (dev / stage) where this change was applied, plus any dashboards or screenshots.
-->

## Success / failure criteria

<!--
Metric-based where possible. Reaching a failure criterion signals: revert.
-->

## Rollback plan

<!--
Step-by-step. Example: "Revert this PR, returning <app> to <previous version>".
-->

<!--
## Notes
- Notes are optional
- Note anything of importance here: such as explanations/reasoning, pull requests that block this one, or…
- TODO items…
-->

<!--
 ChatOps commands:
     - "/rerun": re-trigger the latest workflow run.
     - "/unlock": remove existing application locks, allowing other PRs to deploy to those environments.
     - "/show-prod": show the existing Prod status of applications modified in this PR.
-->

## Checklist

- [ ] [pre-commit hooks](https://github.com/smartcontractkit/infra-k8s#pre-commit-hooks) set up and run
- [ ] Relevant PRs and tickets linked
`;

// infra .github/pull_request_template.md at origin/master, 2026-10-20.
const INFRA_TEMPLATE = `# Description

1. Why is this change necessary?

2. What are the key changes introduced?

<!--
# Design Documentation

Link to any design documents or diagrams relevant to this feature.
-->

# Related Issues/Tickets

- Jira ticket: https://smartcontract-it.atlassian.net/browse/<TICKET_ID>

# Testing Evidence

<!-- Link the PRs that applied this change to lower environments (dev / stage), plus any dashboards or screenshots. -->

# Success / Failure Criteria

<!-- Metric-based where possible. Reaching a failure criterion signals: revert. -->

# Rollback Plan

<!-- Step-by-step. Example: revert this PR and re-apply, returning the resource to its previous configuration. -->

# Checklist

- [ ] **Tagging:** All resources are properly tagged in the metadata.hcl file for the directory being modified. Follow the tagging instructions [here](https://github.com/smartcontractkit/infra/tree/master?tab=readme-ov-file#tagging)
- [ ] **Code Owners:** The [CODEOWNERS file](https://github.com/smartcontractkit/infra/blob/master/.github/CODEOWNERS) is updated to ensure the correct team is assigned for reviewing this PR. If you're unfamiliar with Code Owners, see the GitHub [documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

<!--
# Additional Notes

Any additional information or context relevant to this PR.
-->
`;

// infra-management pull_request_template.md at origin/main, 2026-10-20.
const INFRA_MGMT_TEMPLATE = `## Why is this change necessary?
<!-- Briefly explain the reason for this PR and link the Jira ticket -->
Jira Ticket: https://smartcontract-it.atlassian.net/browse/<ticket>

## What's changing?
<!-- List main changes clearly and concisely -->

## How was this tested?
<!-- Confirm you've tested your changes in lower environments (e.g., dev, stage) and link those PRs -->
- [] Tested successfully in dev/stage or I'm releasing to dev only.
  - testing evidence:

## What are the success / failure criteria?
<!-- Metric-based where possible. Reaching a failure criterion signals: revert. -->

## What is the rollback plan?
<!-- Step-by-step. Usually "revert this PR"; add steps if a revert alone is not enough. -->

<!--
## Additional Notes (Uncomment if applicable)
- [ ] Documentation updates required
- [ ] Notify affected users or teams
- [ ] Backward compatibility verified
-->
`;

const SPECS = parseSectionSpec(`Testing evidence: testing evidence
Success / failure criteria: success / failure criteria
Rollback plan: rollback plan`);

const MGMT_SPECS = parseSectionSpec(`Testing evidence: how was this tested?
Success / failure criteria: what are the success / failure criteria?
Rollback plan: what is the rollback plan?`);

const MGMT_STRIP = [
  "- [] Tested successfully in dev/stage or I'm releasing to dev only.",
  "- testing evidence:",
];

const names = (missing) => missing.map((spec) => spec.display);

test("glob: **/ matches the root and nested paths", () => {
  const re = globToRegExp("**/*.md");
  assert.ok(re.test("README.md"));
  assert.ok(re.test("docs/guide/intro.md"));
  assert.ok(!re.test("README.txt"));
});

test("glob: trailing /** matches under the directory only", () => {
  const re = globToRegExp("projects/ingest-hub-preview/**");
  assert.ok(re.test("projects/ingest-hub-preview/a.yaml"));
  assert.ok(re.test("projects/ingest-hub-preview/apps/a.yaml"));
  assert.ok(!re.test("projects/other/a.yaml"));
});

test("glob: * does not cross a slash", () => {
  const re = globToRegExp("clusters/*.sand.yaml");
  assert.ok(re.test("clusters/main.sand.yaml"));
  assert.ok(!re.test("clusters/sub/main.sand.yaml"));
  assert.ok(!re.test("clusters/main.prod.yaml"));
});

test("spec: parses display and alias", () => {
  assert.deepEqual(parseSectionSpec("Testing evidence: testing evidence"), [
    { display: "Testing evidence", alias: "testing evidence" },
  ]);
});

test("spec: rejects a line without a colon", () => {
  assert.throws(() => parseSectionSpec("Testing evidence"));
});

test("sections: any heading level, case-insensitive", () => {
  const sections = splitSections("# TESTING EVIDENCE\n\nran in stage\n");
  assert.deepEqual(sections.get("testing evidence"), ["", "ran in stage", ""]);
});

test("sections: fenced code is not scanned for headings", () => {
  const body = "## Testing evidence\n\n```yaml\n# not a heading\n```\n";
  const sections = splitSections(body);
  assert.ok(sections.has("testing evidence"));
  assert.ok(!sections.has("not a heading"));
});

test("fresh infra-k8s template: all three sections empty", () => {
  assert.deepEqual(names(missingSections(INFRA_K8S_TEMPLATE, SPECS, [])), [
    "Testing evidence",
    "Success / failure criteria",
    "Rollback plan",
  ]);
});

test("fresh infra template: all three sections empty", () => {
  assert.deepEqual(names(missingSections(INFRA_TEMPLATE, SPECS, [])), [
    "Testing evidence",
    "Success / failure criteria",
    "Rollback plan",
  ]);
});

test("fresh infra-management template: all three sections empty", () => {
  assert.deepEqual(
    names(missingSections(INFRA_MGMT_TEMPLATE, MGMT_SPECS, MGMT_STRIP)),
    ["Testing evidence", "Success / failure criteria", "Rollback plan"],
  );
});

test("infra-management template without strip-lines: defaults count", () => {
  assert.deepEqual(
    names(missingSections(INFRA_MGMT_TEMPLATE, MGMT_SPECS, [])),
    ["Success / failure criteria", "Rollback plan"],
  );
});

test("infra-management: text after the testing evidence label counts", () => {
  const body = INFRA_MGMT_TEMPLATE.replace(
    "  - testing evidence:",
    "  - testing evidence: https://github.com/smartcontractkit/infra-management/pull/1",
  );
  assert.deepEqual(names(missingSections(body, MGMT_SPECS, MGMT_STRIP)), [
    "Success / failure criteria",
    "Rollback plan",
  ]);
});

test("filled sections pass", () => {
  const body = `# Testing Evidence

Ran in stage: PR #1.

# Success / Failure Criteria

Error rate stays flat for 30 minutes.

# Rollback Plan

Revert this PR.
`;
  assert.deepEqual(missingSections(body, SPECS, []), []);
});

test("partial fill names only the missing section", () => {
  const body = `## Testing evidence

Ran in stage: PR #1.

## Rollback plan

Revert this PR.
`;
  assert.deepEqual(names(missingSections(body, SPECS, [])), [
    "Success / failure criteria",
  ]);
});

test("content inside an HTML comment does not count", () => {
  const body = `## Testing evidence

<!-- Ran in stage: PR #1 -->

## Success / failure criteria

<!-- metric -->

## Rollback plan

<!-- revert -->
`;
  assert.equal(missingSections(body, SPECS, []).length, 3);
});

test("commented-out headings are ignored", () => {
  const body = `## Testing evidence

ran in stage

<!--
## Notes
- hidden
-->
`;
  assert.deepEqual(names(missingSections(body, SPECS, [])), [
    "Success / failure criteria",
    "Rollback plan",
  ]);
});

test("null body fails all sections", () => {
  assert.equal(missingSections(null, SPECS, []).length, 3);
});

test("an unterminated HTML comment drops the rest of the body", () => {
  const body = `## Testing evidence

<!-- ran in stage: PR #1
`;
  assert.equal(missingSections(body, SPECS, []).length, 3);
});

test("classifyFiles: docs-only, dev-only, mixed, empty", () => {
  const docs = [globToRegExp("**/*.md")];
  const dev = [globToRegExp("projects/ingest-hub-preview/**")];
  assert.equal(classifyFiles(["README.md"], docs, dev), "docs-only");
  assert.equal(classifyFiles(["a.md", "b.yaml"], docs, dev), null);
  assert.equal(
    classifyFiles(["projects/ingest-hub-preview/a.yaml"], docs, dev),
    "dev-only",
  );
  assert.equal(classifyFiles(["README.md", "a.yaml"], docs, dev), null);
  assert.equal(classifyFiles([], docs, dev), null);
});

const ENV_KEYS = [
  "SECTIONS",
  "STRIP_LINES",
  "DOCS_PATHS",
  "DEV_PATHS",
  "HEAD_PREFIXES",
  "STANDARD_URL",
];

function setEnv(env) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
}

function fakeCore() {
  const calls = { failed: [], info: [], summary: [], writes: 0 };
  return {
    calls,
    info: (msg) => calls.info.push(msg),
    setFailed: (msg) => calls.failed.push(msg),
    summary: {
      addRaw: (msg) => calls.summary.push(msg),
      write: async () => {
        calls.writes += 1;
      },
    },
  };
}

function fakeContext({ ref = "feat/x", body = "", number = 1 } = {}) {
  return {
    repo: { owner: "o", repo: "r" },
    payload: { pull_request: { number, body, head: { ref } } },
  };
}

function fakeGithub(filenames) {
  return {
    rest: {
      pulls: {
        listFiles: async () =>
          filenames.length
            ? { data: filenames.map((filename) => ({ filename })) }
            : { data: [] },
      },
    },
  };
}

const PROD_FILES = ["clusters/main.prod.yaml"];

test("run: empty template fails and names every section", async () => {
  setEnv({
    SECTIONS:
      "Testing evidence: testing evidence\nRollback plan: rollback plan",
  });
  const core = fakeCore();
  await check({
    context: fakeContext({ body: INFRA_K8S_TEMPLATE }),
    core,
    github: fakeGithub(PROD_FILES),
  });
  assert.equal(core.calls.failed.length, 1);
  assert.match(
    core.calls.failed[0],
    /^Please fill in: Testing evidence, Rollback plan\. /,
  );
  assert.match(
    core.calls.failed[0],
    /Infrastructure\+Change\+Management\+Standard$/,
  );
  assert.match(core.calls.summary[0], /- Testing evidence: empty/);
  assert.equal(core.calls.writes, 1);
});

test("run: filled body passes", async () => {
  setEnv({
    SECTIONS:
      "Testing evidence: testing evidence\nRollback plan: rollback plan",
  });
  const body =
    "# Testing Evidence\n\nRan in stage: PR #1.\n\n# Rollback Plan\n\nRevert.\n";
  const core = fakeCore();
  await check({
    context: fakeContext({ body }),
    core,
    github: fakeGithub(PROD_FILES),
  });
  assert.equal(core.calls.failed.length, 0);
  assert.deepEqual(core.calls.info, [
    "All change-management sections are present.",
  ]);
});

test("run: renovate branch is exempt without an API call", async () => {
  setEnv({
    SECTIONS: "Testing evidence: testing evidence",
    HEAD_PREFIXES: "renovate/",
  });
  const core = fakeCore();
  const github = {
    rest: {
      pulls: {
        listFiles: async () => {
          throw new Error("must not be called");
        },
      },
    },
  };
  await check({
    context: fakeContext({ ref: "renovate/lodash-4.x", body: "" }),
    core,
    github,
  });
  assert.equal(core.calls.failed.length, 0);
  assert.match(
    core.calls.info[0],
    /^Exempt \(head branch starts with renovate\/\)/,
  );
});

test("run: docs-only PR is exempt", async () => {
  setEnv({
    SECTIONS: "Testing evidence: testing evidence",
    DOCS_PATHS: "**/*.md",
  });
  const core = fakeCore();
  await check({
    context: fakeContext({ body: "" }),
    core,
    github: fakeGithub(["docs/readme.md"]),
  });
  assert.equal(core.calls.failed.length, 0);
  assert.match(core.calls.info[0], /^Exempt \(docs-only\)/);
});

test("run: dev-only PR is exempt when dev-paths are set", async () => {
  setEnv({
    SECTIONS: "Testing evidence: testing evidence",
    DEV_PATHS: "projects/ingest-hub-preview/**",
  });
  const core = fakeCore();
  await check({
    context: fakeContext({ body: "" }),
    core,
    github: fakeGithub(["projects/ingest-hub-preview/apps/a.yaml"]),
  });
  assert.equal(core.calls.failed.length, 0);
  assert.match(core.calls.info[0], /^Exempt \(dev-only\)/);
});

test("run: empty head-prefixes disables the prefix exemption", async () => {
  setEnv({
    SECTIONS: "Testing evidence: testing evidence",
    HEAD_PREFIXES: "",
  });
  const core = fakeCore();
  await check({
    context: fakeContext({ ref: "renovate/lodash-4.x", body: "" }),
    core,
    github: fakeGithub(PROD_FILES),
  });
  assert.equal(core.calls.failed.length, 1);
});

test("run: empty docs-paths disables the docs exemption", async () => {
  setEnv({ SECTIONS: "Testing evidence: testing evidence", DOCS_PATHS: "" });
  const core = fakeCore();
  await check({
    context: fakeContext({ body: "" }),
    core,
    github: fakeGithub(["docs/readme.md"]),
  });
  assert.equal(core.calls.failed.length, 1);
});

test("run: non-pull-request payload is skipped", async () => {
  const core = fakeCore();
  await check({
    context: { repo: { owner: "o", repo: "r" }, payload: {} },
    core,
    github: fakeGithub(PROD_FILES),
  });
  assert.equal(core.calls.failed.length, 0);
  assert.equal(
    core.calls.info[0],
    "This action is only applicable to pull requests.",
  );
});
