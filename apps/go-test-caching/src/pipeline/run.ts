import { mkdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";
import pLimit from "p-limit";

import {
  GoPackage,
  DiffedHashedCompiledPackages,
  MaybeExecutedPackages,
} from "./index.js";

type ExecaOptions = {
  cwd: string;
  all: true;
  stdout: "pipe";
  stderr: "pipe";
  env: {
    GOCOVERDIR: string;
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
} satisfies ExecaOptions;

export type ExecaReturn = Awaited<ReturnType<typeof execa<ExecaOptions>>>;

type RunResult = RunSuccess | RunFailure;
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
  error: ExecaError<ExecaOptions>;
};

function isRunSuccess(result: RunResult): result is RunSuccess {
  return "execution" in result;
}

function isRunFailure(result: RunResult): result is RunFailure {
  return "error" in result;
}
async function runTestBinary(
  outputDir: string,
  pkg: GoPackage,
  binaryPath: string,
  runFlags: string[],
  coverage: boolean,
  coverageDir: string,
): Promise<RunResult> {
  // GOCOVERDIR is used to store intermediate coverage files. This needs to be unique for each test run.
  const goCoverDir = path.join(
    pkg.directory,
    `go-cover-${path.basename(binaryPath)}`,
  );
  mkdirSync(goCoverDir, { recursive: true });

  const coveragePath = path.join(
    coverageDir,
    `${path.basename(binaryPath)}.cover.out`,
  );
  const logPath = path.join(outputDir, path.basename(binaryPath) + ".run.log");
  const outputStream = createWriteStream(logPath);

  try {
    const localFlags = [...runFlags];
    if (coverage) {
      core.debug(
        `Collecting coverage for ${pkg.importPath} at ${coveragePath}`,
      );
      localFlags.push(`-test.coverprofile=${coveragePath}`);
    }

    core.debug(
      `Exec: ${binaryPath} ${localFlags.join(" ")} (cwd: ${pkg.directory})`,
    );
    const subprocess = execa(binaryPath, localFlags, {
      ...defaultExecaOptions,
      cwd: pkg.directory,
      env: {
        GOCOVERDIR: goCoverDir,
      },
    } satisfies ExecaOptions);

    core.debug(`Logging output to ${logPath}`);
    subprocess.all?.pipe(outputStream);

    const execution = await subprocess;
    return {
      pkg,
      execution,
      output: {
        log: logPath,
        coverage: coverage ? coveragePath : undefined,
      },
    };
  } catch (error) {
    if (!(error instanceof ExecaError)) {
      core.error(`Failed to run test for package ${pkg.importPath}`);
      throw error;
    }
    const execaError = error as ExecaError<ExecaOptions>;
    core.error(
      `Failed to run test for package ${pkg.importPath}: ${execaError.message}`,
    );
    core.info("----------------------------------------");
    core.info(
      `Logs: ${pkg.importPath} ---\n${filterOutputLogs(execaError.stdout)}`,
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

/**
 * Takes in the run logs from a test run, and filters the logs depending on the current job execution log level.
 * If the job is in debug mode, all logs are returned. Otherwise only ERROR logs and higher are returned.
 */
export function filterOutputLogs(logs: string) {
  const lines = logs.split("\n");

  // Don't filter logs
  if (core.isDebug() || !core.isDebug()) {
    // TODO: This is a temporary workaround to only show the first 500 lines of logs
    return lines.slice(0, 500).join("\n");
  }

  const debugLogLevels = ["DEBUG", "INFO", "WARN"];
  const errorLogLevels = ["ERROR", "CRIT", "PANIC", "FATAL"];
  const filteredLines = [];
  let shouldLog = false;
  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("--- FAIL")) {
      shouldLog = true;
      filteredLines.push(line);
      continue;
    }

    const [_, maybeLevel] = trimmedLine.split("\t");
    if (errorLogLevels.includes(maybeLevel)) {
      shouldLog = true;
    } else if (debugLogLevels.includes(maybeLevel)) {
      shouldLog = false;
    }

    if (shouldLog) {
      filteredLines.push(line);
    }
  }
  return filteredLines.join("\n");
}

export async function runConcurrent(
  buildDir: string,
  packages: DiffedHashedCompiledPackages,
  flags: string[],
  coverage: boolean,
  coverageDir: string,
  maxConcurrency: number,
) {
  const limit = pLimit(maxConcurrency);
  const allPackages = Object.values(packages);
  const pkgsToRun = Object.values(allPackages).filter((pkg) => pkg.shouldRun);
  core.info(
    `Running ${pkgsToRun.length} with changes out of ${allPackages.length} total packages`,
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
        coverage,
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
