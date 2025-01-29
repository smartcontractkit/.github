import { mkdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";
import pLimit from "p-limit";

import { BuildOrRunError } from "../utils.js";
import {
  GoPackage,
  DiffedHashedCompiledPackages,
  MaybeExecutedPackages,
} from "../pipeline.js";

export type RunExecaOptions = {
  cwd: string;
  all: true;
  stdout: "pipe";
  stderr: "pipe";
  env: {
    GOCOVERDIR?: string;
  };
};

const defaultExecaOptions = {
  cwd: "",
  all: true,
  stdout: "pipe",
  stderr: "pipe",
  env: {
    GOCOVERDIR: "",
  },
} satisfies RunExecaOptions;

type ExecaReturn = Awaited<ReturnType<typeof execa<RunExecaOptions>>>;
export type RunResult = RunSuccess | RunFailure;
type RunSuccess = {
  output: {
    log: string;
    coverage?: string;
  };
  pkg: GoPackage;
  execution: ExecaReturn;
};
type RunFailure = {
  output: {
    log: string;
  };
  pkg: GoPackage;
  error: ExecaError<RunExecaOptions>;
};

function isRunSuccess(result: RunResult): result is RunSuccess {
  return "execution" in result;
}

function isRunFailure(result: RunResult): result is RunFailure {
  return "error" in result;
}

function handleCoverage(
  runFlags: string[],
  coverageDir: string,
  binaryPath: string,
) {
  if (!coverageDir) {
    return { flags: runFlags };
  }

  const goCoverDir = path.join(
    coverageDir,
    `go-cover-${path.basename(binaryPath)}`,
  );
  mkdirSync(goCoverDir, { recursive: true });

  const coveragePath = path.join(
    coverageDir,
    `${path.basename(binaryPath)}.cover.out`,
  );
  const newFlags = [...runFlags, `-test.coverprofile=${coveragePath}`];

  return { flags: newFlags, coveragePath, goCoverDir };
}

/**
 * Runs the test binary for a given package.
 * @param outputDir The directory to store the output logs
 * @param pkg The package to run the test binary for
 * @param binaryPath The path to the test binary
 * @param runFlags The flags to pass to the test binary
 * @param coverageDir The directory to store the coverage files. If an empty string, coverage is disabled.
 * @returns The result of the test run
 */
export async function runTestBinary(
  outputDir: string,
  pkg: GoPackage,
  binaryPath: string,
  runFlags: string[],
  coverageDir: string,
): Promise<RunResult> {
  const logPath = path.join(outputDir, path.basename(binaryPath) + ".run.log");
  const outputStream = createWriteStream(logPath);

  try {
    const { flags, coveragePath, goCoverDir } = await handleCoverage(
      runFlags,
      coverageDir,
      binaryPath,
    );

    core.debug(
      `Exec: ${binaryPath} ${flags.join(" ")} (cwd: ${pkg.directory})`,
    );
    const subprocess = execa(binaryPath, flags, {
      ...defaultExecaOptions,
      cwd: pkg.directory,
      env: {
        GOCOVERDIR: goCoverDir,
      },
    } satisfies RunExecaOptions);

    core.debug(`Logging output to ${logPath}`);
    subprocess.all?.pipe(outputStream);

    const execution = await subprocess;
    return {
      pkg,
      execution,
      output: {
        log: logPath,
        coverage: coveragePath,
      },
    };
  } catch (error) {
    if (!(error instanceof ExecaError)) {
      core.error(
        `Unknown error encountered while running test for package ${pkg.importPath}`,
      );
      throw error;
    }
    const execaError = error as ExecaError<RunExecaOptions>;
    core.setFailed(`Failed to run test for package ${pkg.importPath}`);
    core.info(
      `Logs: ${pkg.importPath} ---\n${trimOutputLogs(execaError.stdout)}`,
    );
    core.info("----------------------------------------");
    return {
      output: {
        log: logPath,
      },
      pkg,
      error: execaError,
    };
  }
}

export function trimOutputLogs(logs: string) {
  const lines = logs.split("\n");
  if (lines.length >= 1000) {
    core.info(`Trimming logs to first 300 and last 700 lines`);
    const first = lines.slice(0, 300);
    const last = lines.slice(-700);
    const trimmedCount = lines.length - 1000;
    return first
      .concat([`... ${trimmedCount} lines ...`])
      .concat(last)
      .join("\n");
  }

  return logs;
}

export async function runConcurrent(
  buildDir: string,
  packages: DiffedHashedCompiledPackages,
  flags: string[],
  coverageDir: string,
  maxConcurrency: number,
) {
  const limit = pLimit(maxConcurrency);
  const allPackages = Object.values(packages);
  const pkgsToRun = Object.values(allPackages).filter((pkg) => pkg.shouldRun);
  core.info(
    `Running ${pkgsToRun.length} of ${allPackages.length} total packages.`,
  );

  const executing = new Set<string>();
  const tasks = pkgsToRun.map((pkg) =>
    limit(() => {
      executing.add(pkg.importPath);
      return runTestBinary(
        buildDir,
        pkg,
        pkg.compile.binary,
        flags,
        coverageDir,
      ).finally(() => executing.delete(pkg.importPath));
    }),
  );

  const interval = setInterval(() => {
    const remaining = limit.pendingCount + limit.activeCount;
    const completed = pkgsToRun.length - remaining;
    core.info(
      `${completed}/${pkgsToRun.length} tests completed. Active: ${limit.activeCount}, Pending: ${limit.pendingCount}`,
    );
    if (remaining < 10) {
      core.info(
        `Remaining tasks:\n   - ${Array.from(executing).join("\n   - ")}`,
      );
    }
  }, 30000);

  try {
    return await Promise.all(tasks);
  } finally {
    clearInterval(interval);
    core.info("All tasks have been completed.");
  }
}

export function validateRunResultsOrThrow(
  packages: DiffedHashedCompiledPackages,
  results: RunResult[],
): MaybeExecutedPackages {
  const flattenedResults = flattenRunResults(packages, results);
  outputTestsAndRuntime(flattenedResults);

  const failures = results.filter(isRunFailure);
  if (failures.length > 0) {
    core.info(`FAIL`);
    const failedPackages = failures.map((f) => f.pkg.importPath);
    throw new BuildOrRunError("run", failedPackages);
  }

  return flattenedResults;
}

function outputTestsAndRuntime(packages: MaybeExecutedPackages) {
  const values = Object.values(packages);

  const resultsSortedByName = values
    .sort((a, b) => a.importPath.localeCompare(b.importPath))
    .map(formatRunEntry);

  core.info(resultsSortedByName.join("\n"));

  const resultsSortedByDuration = values
    .filter((r) => r.run)
    .sort((a, b) => b.run!.execution.durationMs - a.run!.execution.durationMs)
    .map(formatRunEntry);

  core.info(
    `\n\nSlowest 10 Packages:\n${resultsSortedByDuration.slice(0, 10).join("\n")}`,
  );
}

function flattenRunResults(
  packages: DiffedHashedCompiledPackages,
  results: RunResult[],
): MaybeExecutedPackages {
  core.debug(`Flattening ${results.length} run results`);

  const executedPackages: MaybeExecutedPackages = packages;
  for (const result of results) {
    const { importPath } = result.pkg;

    if (!executedPackages[importPath]) {
      core.warning(`Package ${importPath} not found in packages.`);
      continue;
    }

    const log = result.output.log;
    const coverage = isRunSuccess(result) ? result.output.coverage : undefined;
    const command = isRunSuccess(result)
      ? result.execution.command
      : result.error.command;
    const exitCode = isRunSuccess(result)
      ? result.execution.exitCode
      : result.error.exitCode;
    const cwd = isRunSuccess(result) ? result.execution.cwd : result.error.cwd;
    const durationMs = isRunSuccess(result)
      ? result.execution.durationMs
      : result.error.durationMs;

    executedPackages[importPath].run = {
      log,
      coverage,
      execution: {
        command,
        exitCode: exitCode !== undefined ? exitCode : -1,
        cwd,
        durationMs,
      },
    };
  }

  return executedPackages;
}

function formatRunEntry(
  entry: MaybeExecutedPackages[keyof MaybeExecutedPackages],
) {
  if (entry.run) {
    if (entry.run.execution.exitCode === 0) {
      return `ok  \t${entry.importPath}\t${formatDuration(entry.run.execution.durationMs)}`;
    }
    return `FAIL\t${entry.importPath}\t[test failed]`;
  }
  return `ok  \t${entry.importPath}\t(cached)`;
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}min${seconds}sec`;
}
