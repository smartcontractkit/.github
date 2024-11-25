import { createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError, Result } from "execa";

import { insertWithoutDuplicates } from "../utils.js";
import {
  GoPackage,
  MaybeExecutedPackages,
  HashedCompiledPackages,
} from "./index.js";

type ExecaOptions = {
  cwd: string;
  all: true;
  stdout: "pipe";
  stderr: "pipe";
};
type RunResult = RunSuccess | RunFailure;
type RunSuccess = {
  output: {
    log: string;
  };
  pkg: GoPackage;
  execution: Awaited<ReturnType<typeof execCommand>>;
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

/**
 * Execute a command with flags in a given directory. With standardized options.
 * This mostly exists to properly type the output of execa.
 * @param cmd The command to execute
 * @param flags The flags to pass to the command
 * @param cwd The directory to execute the command in
 * @returns The ResultPromise of the command execution
 */
function execCommand(cmd: string, flags: string[], cwd: string) {
  core.debug(`Exec: ${cmd} ${flags.join(" ")} (cwd: ${cwd})`);
  return execa(cmd, flags, {
    cwd,
    all: true,
    stdout: "pipe",
    stderr: "pipe",
  } satisfies ExecaOptions);
}
async function runTestBinary(
  outputDir: string,
  pkg: GoPackage,
  binaryPath: string,
  runFlags: string[],
): Promise<RunResult> {
  const logPath = path.join(outputDir, path.basename(binaryPath) + ".run.log");
  const outputStream = createWriteStream(logPath);

  try {
    const subprocess = execCommand(binaryPath, runFlags, pkg.directory);
    subprocess.all?.pipe(outputStream);

    const execution = await subprocess;

    return {
      pkg,
      execution,
      output: {
        log: logPath,
      },
    };
  } catch (error) {
    if (!(error instanceof ExecaError)) {
      core.error(`Failed to run test for package ${pkg.importPath}`);
      throw error;
    }
    const execaError = error as ExecaError<ExecaOptions>;
    core.error(`Failed to run test for package ${pkg.importPath}: ${execaError.message}`);
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
  packages: HashedCompiledPackages,
  flags: string[],
  maxConcurrency: number,
) {
  const values = Object.values(packages);
  core.info(
    `Executing ${values.length} packages (concurrency: ${maxConcurrency})`,
  );

  const seen = new Set<string>();
  const finished: RunResult[] = [];
  const executing = new Map<string, Promise<RunResult>>();

  for (const pkg of values) {
    const { importPath } = pkg;

    if (seen.has(importPath)) {
      core.warning(`Duplicate package found: ${importPath}`);
      continue; // Skip adding the duplicate task
    }
    seen.add(importPath);

    const task = runTestBinary(buildDir, pkg, pkg.compile.binary, flags);
    executing.set(importPath, task);

    const executingPromises = Array.from(executing.values());
    if (executingPromises.length >= maxConcurrency) {
      const finishedTask = await Promise.race(executingPromises);
      finished.push(finishedTask);
      const { importPath } = finishedTask.pkg;

      if (!executing.has(finishedTask.pkg.importPath)) {
        core.warning(`Task (${importPath}) not found in executing list`);
        continue;
      }

      core.debug(`Finished Task: ${importPath}`);
      executing.delete(importPath);


      if (finished.length % 5 === 0) {
        core.info(
          `Finished: ${finished.length}, In Progress: ${executingPromises.length}`,
        );
      }
    }
  }

  core.info(`Waiting for ${executing.size} remaining tasks to complete`);
  core.info(`Remaining tasks:\n   -${Array.from(executing.keys()).join("\n   -")}`);

  while (executing.size > 0) {
    const executingPromises = Array.from(executing.values());
    const finishedTask = await Promise.race(executingPromises);
    finished.push(finishedTask);

    const { importPath } = finishedTask.pkg;
    if (!executing.has(finishedTask.pkg.importPath)) {
      core.warning(`Task (${importPath}) not found in executing list`);
      continue;
    }
    executing.delete(importPath);

    core.info(
      `Finished: ${importPath}, Remaining: ${executingPromises.length}`,
    );
  };
  return [...finished ];
}

export function validateRunResultsOrThrow(
  packages: HashedCompiledPackages,
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
  packages: HashedCompiledPackages,
  successes: RunSuccess[],
): MaybeExecutedPackages {
  core.debug(`Flattening ${successes.length} run results`);

  const executedPackages: MaybeExecutedPackages = {};
  for (const success of successes) {
    const { importPath } = success.pkg;
    const { log } = success.output;
    const { command, exitCode, cwd, durationMs } = success.execution;

    const value = {
      ...packages[importPath],
      run: {
        log,
        execution: {
          command,
          exitCode: exitCode !== undefined ? exitCode : -1,
          cwd,
          durationMs,
        },
      },
    };

    insertWithoutDuplicates(success.pkg.importPath, value, executedPackages);
  }

  return executedPackages;
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}min${seconds}sec`;
}
