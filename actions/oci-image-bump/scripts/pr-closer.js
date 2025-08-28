/**
 * Automatically closes PRs that match specific criteria.
 *
 * Filters open PRs by title regex and required labels, then closes matching PRs
 * to prevent multiple open PRs for the same automated updates (e.g., image bumps).
 *
 * PRs are skipped if they have an exempt label or don't match all criteria.
 */
module.exports = async function run({ github, context, core, inputs }) {
  const titleRegex = new RegExp(inputs.titleRegex || ".*");
  const requiredLabels = String(inputs.requiredLabelsCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const exemptLabel = String(inputs.exemptLabel || "").toLowerCase();

  // Create set of exempt PR numbers from the exemptPrNumbers array
  const exemptPrNumbers = new Set();
  if (Array.isArray(inputs.exemptPrNumbers)) {
    inputs.exemptPrNumbers.forEach((num) => {
      if (num) exemptPrNumbers.add(String(num));
    });
  }

  const comment = inputs.closeComment || "";
  const dryRun = Boolean(
    inputs.dryRun && String(inputs.dryRun).toLowerCase() === "true",
  );

  // Use current repository context from workflow.
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  core.info(`Checking open PRs in ${owner}/${repo} ...`);

  const prs = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  let candidates = 0;
  let closed = 0;

  for (const pr of prs) {
    const prLabels = (pr.labels || []).map((l) => l.name || "").filter(Boolean);
    const prLabelsLower = prLabels.map((l) => l.toLowerCase());

    // Check if PR number is in the exempt list
    if (exemptPrNumbers.has(String(pr.number))) {
      core.debug(
        `Skipping PR #${pr.number}: "${pr.title}" - PR number is exempt`,
      );
      continue;
    }

    if (exemptLabel && prLabelsLower.includes(exemptLabel)) {
      core.debug(
        `Skipping PR #${pr.number}: "${pr.title}" due to exempt label: ${exemptLabel}`,
      );
      continue;
    }
    if (!titleRegex.test(pr.title)) {
      core.debug(
        `Skipping PR #${pr.number}: "${pr.title}" - title doesn't match regex: ${titleRegex}`,
      );
      continue;
    }
    const missingLabels = requiredLabels.filter(
      (r) => !prLabelsLower.includes(r),
    );
    if (missingLabels.length) {
      core.debug(
        `Skipping PR #${pr.number}: "${pr.title}" due to missing required labels: ${missingLabels.join(", ")}`,
      );
      continue;
    }

    candidates++;
    core.notice(
      `PR to close: #${pr.number}: "${pr.title}" [${prLabels.join(", ")}]`,
    );

    if (dryRun) {
      core.info(`(dry run) Would close PR #${pr.number}`);
      continue;
    }

    if (comment) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: comment,
      });
    }
    await github.rest.pulls.update({
      owner,
      repo,
      pull_number: pr.number,
      state: "closed",
    });
    closed++;
  }

  await core.summary
    .addHeading("PR Closer Summary")
    .addList([
      `Open PRs scanned: ${prs.length}`,
      `Candidates found: ${candidates}`,
      `PRs closed: ${dryRun ? 0 : closed}${dryRun ? " _(dry run mode)_" : ""}`,
    ])
    .write();
};
