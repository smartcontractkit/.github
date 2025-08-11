/**
 * Fails the workflow if any of the specified labels are present on the PR.
 *
 * Inputs (via environment):
 *   FAIL_LABELS: comma-separated list of labels to check (default: "do-not-merge")
 */

module.exports = async ({ context, core }) => {
  const failLabels = (process.env.FAIL_LABELS || "do-not-merge")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  const pr = context.payload.pull_request;
  if (!pr) {
    core.info("This action is only applicable to pull requests.");
    return;
  }

  const prLabels = (pr.labels || []).map((l) => l.name.toLowerCase());
  const found = failLabels.find((label) => prLabels.includes(label));

  if (found) {
    const msg = `❌ This PR has a label that blocks merging: \`${found}\`.\nPlease remove the label to proceed.`;
    core.summary.addRaw(msg);
    core.setFailed(msg);
    return;
  }

  core.info(
    `No blocking labels found. Blocking labels checked: [${failLabels.join(", ")}]`,
  );
};
