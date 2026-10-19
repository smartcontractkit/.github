function parseImages(raw) {
  const images = [];
  for (const [i, line] of (raw || "").split("\n").entries()) {
    const entry = line.trim();
    if (!entry) continue;
    const parts = entry.split("=").map((p) => p.trim());
    if (parts.length !== 2 || !parts[0]) {
      throw new Error(
        `images line ${i + 1}: expected "stream=tag", got "${entry}"`,
      );
    }
    const [stream, tag] = parts;
    if (!tag) continue;
    images.push({ stream, tag });
  }
  return images;
}

function readInputs(env) {
  const [owner, repo, ...rest] = (env.HUB_REPO || "").split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error("hub-repo must be in the form owner/name");
  }
  if (!env.AUDIENCE) {
    throw new Error("audience is required");
  }
  return {
    owner,
    repo,
    audience: env.AUDIENCE,
    hubWorkflow: env.HUB_WORKFLOW,
    hubRef: env.HUB_REF,
    producer: env.PRODUCER,
    images: parseImages(env.IMAGES),
    correlationId:
      env.CORRELATION_ID || `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
    sourceRunUrl:
      env.SOURCE_RUN_URL ||
      `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
  };
}

async function run({ github, core }) {
  const env = process.env;

  // Inputs passed as vars or literals aren't masked, and these name internal services.
  for (const value of [env.HUB_REPO, env.AUDIENCE]) {
    if (value) core.setSecret(value);
  }

  const {
    owner,
    repo,
    audience,
    hubWorkflow,
    hubRef,
    producer,
    images,
    correlationId,
    sourceRunUrl,
  } = readInputs(env);

  const imagesJson = JSON.stringify(images);
  core.setOutput("images", imagesJson);

  if (images.length === 0) {
    core.warning("No published images to fan out; nothing dispatched.");
    core.setOutput("dispatched", "false");
    return;
  }

  // Minted last: the hub rejects it once GitHub's ~5 minute expiry passes.
  const idToken = await core.getIDToken(audience).catch((err) => {
    throw new Error(
      `Could not mint an OIDC token; the calling job needs "permissions: id-token: write". ${err.message}`,
    );
  });
  core.setSecret(idToken);

  await github.rest.actions
    .createWorkflowDispatch({
      owner,
      repo,
      workflow_id: hubWorkflow,
      ref: hubRef,
      inputs: {
        producer,
        "id-token": idToken,
        images: imagesJson,
        "correlation-id": correlationId,
        "source-run-url": sourceRunUrl,
      },
    })
    .catch((err) => {
      // Rethrow message-only: the Octokit error's request body holds the id-token.
      const status = err.status ? ` (HTTP ${err.status})` : "";
      throw new Error(`Dispatch failed${status}: ${err.message}`);
    });

  core.setOutput("dispatched", "true");

  // The step summary is not masked, so it must never include the hub or audience.
  await core.summary
    .addHeading("Release fan-out dispatched", 3)
    .addTable([
      [
        { data: "field", header: true },
        { data: "value", header: true },
      ],
      ["producer", `<code>${producer}</code>`],
      ["images", `<code>${imagesJson}</code>`],
      ["correlation-id", `<code>${correlationId}</code>`],
    ])
    .write();
}

module.exports = { run, readInputs, parseImages };
