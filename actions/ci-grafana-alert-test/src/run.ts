import artifactClient from "@actions/artifact";
import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import * as tc from "@actions/tool-cache";

import * as fs from "fs";
import * as path from "path";

import { extractCheckOutputs } from "./outputs";
import { resolveAsset } from "./release";
import { parseResult, type GrafanaAlertCheckResult } from "./result";
import { buildSummaryBody } from "./summary";
import { resolveCheckWindow } from "./window";

const RELEASE_VERSION = "v0.1.1";
const BIN_NAME = "grafana-alertcheck";

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

function grafanaEnv(): { [key: string]: string } {
  return {
    GRAFANA_URL: core.getInput("grafana-url", { required: true }),
    GRAFANA_TOKEN: core.getInput("grafana-token", { required: true }),
  };
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

async function runRecord(binPath: string): Promise<void> {
  const alerts = core.getInput("alerts");
  if (alerts.trim() === "") {
    throw new Error(
      "ci-grafana-alert-test: 'alerts' is required with mode: record",
    );
  }

  const dir = gateDir();
  fs.mkdirSync(dir, { recursive: true });
  const alertsFile = path.join(
    makeTempDir("grafana-alert-gate-"),
    "alerts.txt",
  );
  fs.writeFileSync(alertsFile, alerts);

  const logPath = path.join(dir, "log.jsonl");
  const args = ["watch", "--out", logPath, "--alerts", alertsFile];

  const folder = core.getInput("folder");
  if (folder) args.push("--folder", folder);
  const concurrency = core.getInput("concurrency");
  if (concurrency) args.push("--concurrency", concurrency);
  const pollInterval = core.getInput("poll-interval");
  if (pollInterval) args.push("--poll-interval", pollInterval);

  const result = await getExecOutput(binPath, args, { env: grafanaEnv() });
  if (result.exitCode !== 0) {
    throw new Error(
      `ci-grafana-alert-test: grafana-alertcheck watch failed (exit ${result.exitCode})`,
    );
  }

  core.setOutput("log-path", logPath);
  core.setOutput("pidfile", `${logPath}.pid`);
}

function buildCheckArgs(window: { from: string; to: string }): string[] {
  const logPath = path.join(gateDir(), "log.jsonl");
  const args = [
    "check",
    "--in",
    logPath,
    "--from",
    window.from,
    "--to",
    window.to,
    "--output",
    "json",
  ];

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
  const folder = core.getInput("folder");
  if (folder) args.push("--folder", folder);
  const concurrency = core.getInput("concurrency");
  if (concurrency) args.push("--concurrency", concurrency);

  return args;
}

async function writeStepSummary(resultPath: string): Promise<void> {
  const raw = readNonEmpty(resultPath);
  const body = raw
    ? buildSummaryBody(parseResult(raw))
    : "_No result was produced — the gate could not run to completion. See the job log._";
  await core.summary.addRaw(`### Grafana alert gate\n\n${body}`).write();
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

async function uploadEvidenceLog(logPath: string): Promise<void> {
  if (!fs.existsSync(logPath)) {
    core.warning("No evidence log to upload");
    return;
  }

  const runId = process.env.GITHUB_RUN_ID ?? "";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "";
  const artifactName = `grafana-alert-gate-log-${runId}-${runAttempt}`;

  await artifactClient.uploadArtifact(
    artifactName,
    [logPath],
    path.dirname(logPath),
  );
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

async function runCheck(binPath: string): Promise<void> {
  const alerts = core.getInput("alerts");
  if (alerts.trim() !== "") {
    throw new Error(
      "ci-grafana-alert-test: 'alerts' is refused with mode: check — the recorded log already carries its own alert set",
    );
  }

  const window = resolveCheckWindow(
    core.getInput("from"),
    core.getInput("to"),
    core.getInput("duration"),
  );
  const args = buildCheckArgs(window);

  const dir = gateDir();
  fs.mkdirSync(dir, { recursive: true });
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

  await writeStepSummary(resultPath);
  await setCheckOutputs(resultPath, exitCode);

  if (exitCode !== 0) {
    await uploadEvidenceLog(path.join(dir, "log.jsonl"));
  }

  enforceGate(exitCode, core.getInput("fail-on-violation"));
}

export async function run(): Promise<void> {
  try {
    const mode = core.getInput("mode", { required: true });
    if (mode !== "record" && mode !== "check") {
      throw new Error(
        `ci-grafana-alert-test: mode must be 'record' or 'check', got '${mode}'`,
      );
    }

    const binPath = await installBinary();

    if (mode === "record") {
      await runRecord(binPath);
    } else {
      await runCheck(binPath);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}
