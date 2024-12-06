import { mkdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";
import pLimit from "p-limit";

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
    binary: string;
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
      core.error(`Failed to run test for package ${pkg.importPath}`);
      throw error;
    }
    const execaError = error as ExecaError<RunExecaOptions>;
    core.error(
      `Failed to run test for package ${pkg.importPath}: ${execaError.message}`,
    );
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
    } as RunFailure;
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
  outputTop5SlowestTests(results);

  const failures = results.filter(isRunFailure);
  if (failures.length > 0) {
    core.setFailed(
      `Test Package Failures: ${failures.map((f) => f.pkg.importPath).join(", ")}`,
    );
    throw new Error(
      `${failures.length} tests completed with an error, or failed to run. See output for details.`,
    );
  }

  const successes = results.filter(isRunSuccess);
  return flattenRunResults(packages, successes);
}

function outputTop5SlowestTests(results: RunResult[]) {
  if (results.length === 0) {
    return;
  }

  const sorted = results
    .map((result) => {
      if (isRunFailure(result)) {
        return {
          importPath: result.pkg.importPath,
          durationMs: result.error.durationMs,
        };
      }
      return {
        importPath: result.pkg.importPath,
        durationMs: result.execution.durationMs,
      };
    })
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  core.info("Top 5 slowest tests:");
  for (const { importPath, durationMs } of sorted) {
    core.info(`  ${importPath} (${formatDuration(durationMs)})`);
  }
}

function flattenRunResults(
  packages: DiffedHashedCompiledPackages,
  successes: RunSuccess[],
): MaybeExecutedPackages {
  core.debug(`Flattening ${successes.length} run results`);

  const executedPackages: MaybeExecutedPackages = packages;
  for (const success of successes) {
    const { importPath } = success.pkg;

    if (!executedPackages[importPath]) {
      core.warning(`Package ${importPath} not found in packages.`);
      continue;
    }

    const { log, coverage } = success.output;
    const { command, exitCode, cwd, durationMs } = success.execution;

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

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}min${seconds}sec`;
}
