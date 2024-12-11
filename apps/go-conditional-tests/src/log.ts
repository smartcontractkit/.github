import { readdirSync } from "fs";
import * as path from "path";

import { DefaultArtifactClient } from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";

export function logSection(title: string) {
  const separator = "=".repeat(title.length);
  core.info(`\n${separator}\n${title}\n${separator}\n`);
}

export function logObject(title: string, obj: Record<string, unknown>) {
  core.info(`${title} - found ${Object.keys(obj).length} entries`);
  if (core.isDebug()) {
    core.debug(`${title} (object) - ${JSON.stringify(obj)}`);
  }
}

export function uploadBuildLogs(directory: string, key: string) {
  core.info("Uploading build logs");

  const buildLogs = getFilesInDir(directory, ".compile.log");
  const runId = github.context.runId;
  const artifactName = `build-logs-${key}-${runId}`;
  core.debug(`Uploading build logs to ${artifactName}`);
  core.debug(`Build log files: ${buildLogs.join(", ")}`);

  if (buildLogs.length === 0) {
    core.debug("No build logs found, skipping upload.");
    return;
  }

  try {
    const client = new DefaultArtifactClient();
    return client.uploadArtifact(artifactName, buildLogs, directory, {
      retentionDays: 3,
    });
  } catch (error) {
    core.error("Error uploading build logs: " + error);
  }
}

export function uploadRunLogs(directory: string, key: string) {
  core.info("Uploading run logs");

  const runLogs: string[] = getFilesInDir(directory, ".run.log");
  const runId = github.context.runId;
  const artifactName = `run-logs-${key}-${runId}`;
  core.info(`Found ${runLogs.length} run logs`);
  core.debug(`Uploading run logs to ${artifactName}`);
  core.debug(`Run log files: ${runLogs.join(", ")}`);

  if (runLogs.length === 0) {
    core.debug("No run logs found, skipping upload.");
    return;
  }

  try {
    const client = new DefaultArtifactClient();
    return client.uploadArtifact(artifactName, runLogs, directory, {
      retentionDays: 3,
    });
  } catch (error) {
    core.error("Error uploading run logs: " + error);
  }
}

export function uploadCoverage(directory: string, key: string) {
  core.info("Uploading coverage");

  const coverageFiles: string[] = getFilesInDir(directory, ".cover.out");
  const runId = github.context.runId;
  const artifactName = `coverage-${key}-${runId}`;
  core.debug(`Uploading coverage to ${artifactName}`);
  core.debug(`Coverage files: ${coverageFiles.join(", ")}`);

  if (coverageFiles.length === 0) {
    core.debug("No coverage files found, skipping upload.");
    return;
  }

  try {
    const client = new DefaultArtifactClient();
    return client.uploadArtifact(artifactName, coverageFiles, directory, {
      retentionDays: 3,
    });
  } catch (error) {
    core.error("Error uploading coverage logs: " + error);
  }
}

export function uploadStateFile(filePath: string) {
  core.debug("Uploading state object");

  try {
    const artifactName = `state-${path.basename(filePath).replace(".json", "")}-${github.context.runId}`;
    const directory = path.dirname(filePath);
    const client = new DefaultArtifactClient();
    return client.uploadArtifact(artifactName, [filePath], directory, {
      retentionDays: 3,
    });
  } catch (error) {
    core.warning("Error uploading state object: " + error);
  }
}

function getFilesInDir(directory: string, extension: string): string[] {
  const files: string[] = readdirSync(directory);
  return files
    .filter((file) => file.endsWith(extension))
    .map((file) => {
      return path.join(directory, file);
    });
}
