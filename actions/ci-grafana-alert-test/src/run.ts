import artifactClient from "@actions/artifact";
import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";

import * as fs from "fs";
import * as path from "path";

import { findPullRequestNumber, upsertSummaryComment } from "./comment";
import { extractCheckOutputs } from "./outputs";
import { resolveAsset } from "./release";
import { parseResult, type GrafanaAlertCheckResult } from "./result";
import { buildSummaryBody } from "./summary";
import { resolveCheckWindow, resolveLiveWindow } from "./window";

const RELEASE_VERSION = "v0.1.7";
const BIN_NAME = "grafana-alertcheck";
const SUMMARY_TITLE = "### Grafana alert gate";

function runnerTemp(): string {
  const tmp = process.env.RUNNER_TEMP;
  if (!tmp) {
    throw new Error("ci-grafana-alert-test: RUNNER_TEMP is not set");
  }
  return tmp;
}

// Deterministic across `record` and `check` invocations (same job, same runner)
// so the check finds the recorded log by convention on the local filesystem.
function gateDir(): string {
  return path.join(runnerTemp(), "grafana-alert-gate");
}

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(runnerTemp(), prefix));
}

function readNonEmpty(filePath: string): string | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  return content.length > 0 ? content : undefined;
}

// Missing values are left empty on purpose: grafana-alertcheck reads both from
// the environment and rejects an empty one itself.
function grafanaEnv(): { [key: string]: string } {
  return {
    GRAFANA_URL: core.getInput("grafana-url"),
    GRAFANA_TOKEN: core.getInput("grafana-token"),
  };
}

// Proof, for a later `stop` in the same job, that `check`/`live` ran to
// completion — regardless of its exit code.
function checkCompletedMarkerPath(): string {
  return path.join(gateDir(), "check-completed");
}

function markCheckCompleted(): void {
  fs.mkdirSync(gateDir(), { recursive: true });
  fs.writeFileSync(checkCompletedMarkerPath(), new Date().toISOString());
}

async function installBinary(): Promise<string> {
  const runnerOs = process.env.RUNNER_OS ?? "";
  const runnerArch = process.env.RUNNER_ARCH ?? "";

  const asset = resolveAsset(RELEASE_VERSION, runnerOs, runnerArch);
  const binDir = makeTempDir("grafana-alertcheck-bin-");

  const tarball = await tc.downloadTool(asset.url);
  await tc.extractTar(tarball, binDir);

  const binPath = path.join(binDir, BIN_NAME);
  fs.chmodSync(binPath, 0o755);
  return binPath;
}

function writeAlertsFile(alerts: string): string {
  const alertsFile = path.join(
    makeTempDir("grafana-alert-gate-"),
    "alerts.txt",
  );
  fs.writeFileSync(alertsFile, alerts);
  return alertsFile;
}

export interface AlertSelection {
  alertsPath?: string;
  includeLabels?: string;
  excludeLabels?: string;
}

// Every selection form is forwarded as given, even combinations the CLI
// refuses: it validates them itself, and it is the one authority on the rules.
function alertSelection(
  alerts: string,
  includeLabels: string,
  excludeLabels: string,
): AlertSelection {
  return {
    alertsPath: alerts.trim() !== "" ? writeAlertsFile(alerts) : undefined,
    includeLabels: includeLabels.trim() !== "" ? includeLabels : undefined,
    excludeLabels: excludeLabels.trim() !== "" ? excludeLabels : undefined,
  };
}

function addSelectionArgs(args: string[], selection: AlertSelection): void {
  if (selection.alertsPath) {
    args.push("--alerts", selection.alertsPath);
  }
  if (selection.includeLabels) {
    args.push("--include-labels", selection.includeLabels);
  }
  if (selection.excludeLabels) {
    args.push("--exclude-labels", selection.excludeLabels);
  }
}

async function runRecord(binPath: string): Promise<void> {
  const dir = gateDir();
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, "log.jsonl");
  const args = ["watch", "--out", logPath];
  addSelectionArgs(
    args,
    alertSelection(
      core.getInput("alerts"),
      core.getInput("include-labels"),
      core.getInput("exclude-labels"),
    ),
  );

  const folder = core.getInput("folder");
  if (folder) args.push("--folder", folder);
  const concurrency = core.getInput("concurrency");
  if (concurrency) args.push("--concurrency", concurrency);
  const pollInterval = core.getInput("poll-interval");
  if (pollInterval) args.push("--poll-interval", pollInterval);
  const until = core.getInput("until");
  if (until) args.push("--until", until);

  const result = await getExecOutput(binPath, args, { env: grafanaEnv() });
  if (result.exitCode !== 0) {
    throw new Error(
      `ci-grafana-alert-test: grafana-alertcheck watch failed (exit ${result.exitCode})`,
    );
  }

  core.setOutput("log-path", logPath);
  core.setOutput("pidfile", `${logPath}.pid`);
}

export interface CheckPaths {
  logPath?: string;
}

export function buildCheckArgs(
  window: { from?: string; to: string },
  live: boolean,
  paths: CheckPaths,
  selection: AlertSelection = {},
): string[] {
  const args = ["check"];

  addSelectionArgs(args, selection);
  if (window.from) args.push("--from", window.from);
  if (!live) {
    if (!paths.logPath) {
      throw new Error(
        "ci-grafana-alert-test: mode: check needs a recorded log",
      );
    }
    args.push("--in", paths.logPath);
  }

  args.push("--to", window.to, "--output", "json");

  const states = core.getInput("states");
  if (states) args.push("--states", states);
  const preexisting = core.getInput("preexisting");
  if (preexisting) args.push("--preexisting", preexisting);
  const minObserved = core.getInput("min-observed");
  if (minObserved) args.push("--min-observed", minObserved);
  if (core.getInput("allow-paused") === "true") args.push("--allow-paused");
  if (core.getInput("nodata-is-unobservable") === "true") {
    args.push("--nodata-is-unobservable");
  }
  const failFast = core.getInput("fail-fast") !== "false";
  args.push(failFast ? "--fail-fast" : "--fail-fast=false");
  const folder = core.getInput("folder");
  if (folder) args.push("--folder", folder);
  const concurrency = core.getInput("concurrency");
  if (concurrency) args.push("--concurrency", concurrency);

  return args;
}

async function writeStepSummary(
  resultPath: string,
  includeInstances: boolean,
): Promise<string> {
  const raw = readNonEmpty(resultPath);
  const body = raw
    ? buildSummaryBody(parseResult(raw), includeInstances)
    : "_No result was produced — the gate could not run to completion. See the job log._";
  await core.summary.addRaw(`${SUMMARY_TITLE}\n\n${body}`).write();
  return body;
}

// The SHA that identifies the deployed/finished work across event types:
// a deployment_status carries it on the deployment, a pull_request on the PR
// head (context.sha is the synthetic merge commit there), and manually
// dispatched runs fall back to the checked-out commit.
function eventSha(): string | undefined {
  const { payload, sha } = github.context;
  return (
    payload.pull_request?.head?.sha ||
    payload.deployment?.sha ||
    sha ||
    undefined
  );
}

function runUrl(): string {
  const { owner, repo } = github.context.repo;
  const runId = process.env.GITHUB_RUN_ID ?? "";
  return `${github.context.serverUrl}/${owner}/${repo}/actions/runs/${runId}`;
}

export function missingCheckCommentBody(runUrl: string): string {
  return (
    "❌ **The gate did not run** — the workflow failed before `check`/`live` " +
    `classified the window, so there is no verdict for this run. See the [job run](${runUrl}).`
  );
}

async function postSummaryComment(body: string): Promise<void> {
  const token = core.getInput("github-token");
  if (!token) {
    core.warning("No 'github-token'; skipping the PR summary comment.");
    return;
  }

  const { owner, repo } = github.context.repo;
  const sha = eventSha();
  if (!sha) {
    core.info("No commit SHA in this event; skipping the PR summary comment.");
    return;
  }

  const octokit = github.getOctokit(token);
  let prNumber: number | undefined;
  try {
    prNumber = await findPullRequestNumber(octokit, owner, repo, sha);
  } catch (error) {
    core.warning(
      `Failed to resolve the pull request for the summary comment: ${String(error)}`,
    );
    return;
  }
  if (!prNumber) {
    core.info(
      `No open pull request has ${sha} as its head; skipping the PR summary comment.`,
    );
    return;
  }

  await upsertSummaryComment(
    octokit,
    owner,
    repo,
    prNumber,
    `${SUMMARY_TITLE}\n\n${body}`,
  );
}

async function setCheckOutputs(
  resultPath: string,
  exitCode: number,
): Promise<void> {
  core.setOutput("passed", exitCode === 0 ? "true" : "false");

  const raw = readNonEmpty(resultPath);
  const result: GrafanaAlertCheckResult = raw ? parseResult(raw) : {};

  const outputs = extractCheckOutputs(result);
  core.setOutput("violation-count", outputs.violationCount.toString());
  core.setOutput("violations", outputs.violations);
  core.setOutput("outcomes", outputs.outcomes);
}

async function uploadArtifactNamed(
  prefix: string,
  filePath: string,
): Promise<void> {
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "";

  await artifactClient.uploadArtifact(
    `grafana-alert-gate-${prefix}-${runId}-${runAttempt}`,
    [filePath],
    path.dirname(filePath),
  );
}

async function uploadEvidenceLog(logPath: string): Promise<void> {
  if (!fs.existsSync(logPath)) {
    core.warning("No evidence log to upload");
    return;
  }
  await uploadArtifactNamed("log", logPath);
}

async function uploadResult(resultPath: string): Promise<void> {
  if (readNonEmpty(resultPath) === undefined) {
    core.warning("No result to upload");
    return;
  }
  await uploadArtifactNamed("result", resultPath);
}

function enforceGate(exitCode: number, failOnViolation: string): void {
  if (exitCode === 0) {
    return;
  }
  if (exitCode === 1) {
    if (failOnViolation !== "false") {
      throw new Error(
        "ci-grafana-alert-test: the window contains at least one violation",
      );
    }
    core.warning(
      "violations detected; fail-on-violation is false so the job continues",
    );
    return;
  }
  throw new Error(
    `ci-grafana-alert-test: could not complete the check (exit ${exitCode}) — this is a could-not-check result and always fails the job regardless of fail-on-violation`,
  );
}

async function runCheck(binPath: string, live: boolean): Promise<void> {
  const selection = alertSelection(
    core.getInput("alerts"),
    core.getInput("include-labels"),
    core.getInput("exclude-labels"),
  );

  const window = live
    ? resolveLiveWindow(
        core.getInput("from"),
        core.getInput("to"),
        core.getInput("observation_window"),
      )
    : resolveCheckWindow(
        core.getInput("from"),
        core.getInput("to"),
        core.getInput("observation_window"),
      );

  const dir = gateDir();
  const paths: CheckPaths = {};
  if (!live) {
    fs.mkdirSync(dir, { recursive: true });
    paths.logPath = path.join(dir, "log.jsonl");
  }

  const args = buildCheckArgs(window, live, paths, selection);
  const resultPath = path.join(
    makeTempDir("grafana-alert-gate-"),
    "result.json",
  );

  let exitCode: number;
  try {
    const result = await getExecOutput(binPath, args, {
      env: grafanaEnv(),
      ignoreReturnCode: true,
      silent: true,
      listeners: {
        stderr: (data: Buffer) => {
          process.stdout.write(data);
        },
      },
    });
    exitCode = result.exitCode;
    fs.writeFileSync(resultPath, result.stdout);
  } catch (error) {
    exitCode = 2;
    core.error(`grafana-alertcheck failed to run: ${String(error)}`);
  }

  markCheckCompleted();

  const body = await writeStepSummary(
    resultPath,
    core.getInput("print-instances-details") === "true",
  );
  await setCheckOutputs(resultPath, exitCode);
  await postSummaryComment(body);

  if (exitCode !== 0) {
    if (live) {
      await uploadResult(resultPath);
    } else {
      await uploadEvidenceLog(path.join(dir, "log.jsonl"));
    }
  }

  enforceGate(exitCode, core.getInput("fail-on-violation"));
}

async function runStop(binPath: string): Promise<void> {
  const logPath = path.join(gateDir(), "log.jsonl");
  const result = await getExecOutput(binPath, ["stop", "--out", logPath], {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stderr: (data: Buffer) => {
        process.stdout.write(data);
      },
    },
  });

  if (fs.existsSync(checkCompletedMarkerPath())) {
    core.info(
      "check already ran in this job; leaving the summary comment as is.",
    );
  } else if (fs.existsSync(logPath)) {
    await postSummaryComment(missingCheckCommentBody(runUrl()));
  } else {
    core.info(
      "No recorder ran in this job; skipping the missing-check comment.",
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      `ci-grafana-alert-test: grafana-alertcheck stop failed (exit ${result.exitCode})`,
    );
  }
}

export async function run(): Promise<void> {
  try {
    const mode = core.getInput("mode", { required: true });
    if (
      mode !== "record" &&
      mode !== "check" &&
      mode !== "live" &&
      mode !== "stop"
    ) {
      throw new Error(
        `ci-grafana-alert-test: mode must be 'record', 'check', 'live' or 'stop', got '${mode}'`,
      );
    }

    const binPath = await installBinary();

    if (mode === "record") {
      await runRecord(binPath);
    } else if (mode === "stop") {
      await runStop(binPath);
    } else {
      await runCheck(binPath, mode === "live");
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}
