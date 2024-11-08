import { createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";

import { insertWithoutDuplicates } from "../utils.js";
import {
  GoPackage,
  ExecutedPackages,
  HashedCompiledPackages,
} from "./index.js";

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
  error: ExecaError;
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
  });
}

function setupStderrDebugPipe(
  subprocess: ReturnType<typeof execCommand>,
  importPath: string,
) {
  if (core.isDebug()) {
    subprocess.stderr.on("data", (chunk) => {
      const lines: string[] = chunk.toString().split("\n"); // Split into lines
      for (const line of lines) {
        if (line.trim()) {
          process.stdout.write(`stderr: [${importPath}] ${line}\n`);
        }
      }
    });
  }
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
    setupStderrDebugPipe(subprocess, pkg.importPath);

    const execution = await subprocess;

    return {
      pkg,
      execution,
      output: {
        log: logPath,
      },
    };
  } catch (error) {
    core.setFailed(`Failed to run test for package ${pkg.importPath}`);

    if (!(error instanceof ExecaError)) {
      throw error;
    }

    return {
      output: {
        log: logPath,
      },
      pkg,
      error,
    } as RunFailure;
  }
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

      if (!executing.has(finishedTask.pkg.importPath)) {
        core.warning("Task not found in executing list");
        continue;
      }

      core.debug(`Finished Task: ${finishedTask.pkg.importPath}`);
      executing.delete(finishedTask.pkg.importPath);

      if (finished.length % 5 === 0) {
        core.info(
          `Finished: ${finished.length}, In Progress: ${executingPromises.length}`,
        );
      }
    }
  }

  const results = await Promise.all(executing.values());
  return [...finished, ...results];
}

export function validateRunResultsOrThrow(
  packages: HashedCompiledPackages,
  results: RunResult[],
): ExecutedPackages {
  const failures = results.filter(isRunFailure);
  if (failures.length > 0) {
    failures.forEach((failure) => {
      core.error(
        `Failed to run test for package ${failure.pkg.importPath}: ${failure.error.message}`,
      );
    });
    throw new Error(
      "At least one test binary completed with an error, or failed to run.",
    );
  }
  const successes = results.filter(isRunSuccess);

  return flattenRunResults(packages, successes);
}

function flattenRunResults(
  packages: HashedCompiledPackages,
  successes: RunSuccess[],
): ExecutedPackages {
  core.debug(`Flattening ${successes.length} run results`);

  const executedPackages: ExecutedPackages = {};
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

    insertWithoutDuplicates(success.pkg.importPath, value, packages);
  }

  return executedPackages;
}

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}min${seconds}sec`;
}
