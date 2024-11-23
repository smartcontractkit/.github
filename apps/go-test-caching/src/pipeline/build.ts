import { existsSync, readdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";

import { GoPackage, CompiledPackages, FilteredPackages } from "./index.js";
import { insertWithoutDuplicates } from "../utils.js";

type CompilationResult = CompilationSuccess | CompilationFailure;
export type CompilationSuccess = {
  output: {
    binary: string;
    log: string;
  };
  pkg: GoPackage;
  execution: Awaited<ReturnType<typeof execCommand>>;
};

new ExecaError();

type CompilationFailure = {
  output: {
    binary: string;
    log: string;
  };
  pkg: GoPackage;
  error: ExecaError;
};

function isCompilationSuccess(
  result: CompilationResult,
): result is CompilationSuccess {
  return "execution" in result;
}

function isCompilationFailure(
  result: CompilationResult,
): result is CompilationFailure {
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
    stdout: "pipe",
    stderr: "pipe",
    all: true,
  });
}

function setupStdoutDebugPipe(
  subprocess: ReturnType<typeof execCommand>,
  importPath: string,
) {
  if (core.isDebug()) {
    subprocess.stdout.on("data", (chunk) => {
      const lines: string[] = chunk.toString().split("\n"); // Split into lines
      for (const line of lines) {
        if (line.trim()) {
          process.stdout.write(`stdout: [${importPath}] ${line}\n`);
        }
      }
    });
  }
}

// Exported for testing only
export async function compileTestBinary(
  workingDir: string,
  outputDir: string,
  pkg: GoPackage,
): Promise<CompilationResult> {
  const filename = pkg.importPath.replace(/\//g, "-") + "-test";
  const binaryPath = path.join(outputDir, filename);

  const logPath = path.join(outputDir, filename + ".compile.log");
  const outputStream = createWriteStream(logPath);

  try {
    const flags = ["test", "-c", "-o", binaryPath, "-vet=off", pkg.importPath];
    const subprocess = execCommand("go", flags, workingDir);
    core.debug(`Logging output to ${logPath}`);

    subprocess.all?.pipe(outputStream);
    setupStdoutDebugPipe(subprocess, pkg.importPath);

    const execution = await subprocess;
    return {
      output: {
        binary: binaryPath,
        log: logPath,
      },
      pkg,
      execution,
    } as CompilationSuccess;
  } catch (error) {
    core.setFailed(`Failed to compile test for package ${pkg.importPath}`);
    if (!(error instanceof ExecaError)) {
      throw error;
    }

    return {
      output: {
        binary: binaryPath,
        log: logPath,
      },
      pkg,
      error,
    } as CompilationFailure;
  }
}

export async function compileConcurrent(
  workingDir: string,
  outputDir: string,
  packages: FilteredPackages,
  maxConcurrency: number,
) {
  const values = Object.values(packages);
  core.info(
    `Building ${values.length} packages (concurrency: ${maxConcurrency})`,
  );

  const fivePercent = Math.floor(values.length * 0.05);

  const seen = new Set<string>();
  const finished: CompilationResult[] = [];
  const executing = new Map<string, Promise<CompilationResult>>();

  for (const pkg of values) {
    const { importPath } = pkg;

    if (seen.has(importPath)) {
      core.setFailed(
        `Duplicate package found when dispatching compiles: ${importPath}`,
      );
      continue;
    }
    seen.add(importPath);

    const task = compileTestBinary(workingDir, outputDir, pkg);
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

      if (finished.length % fivePercent === 0) {
        core.info(
          `Finished: ${finished.length}/${values.length}, In Progress: ${executingPromises.length}`,
        );
      }
    }
  }

  // Wait for all remaining tasks to complete
  const remainingResults = await Promise.all(executing.values());
  return [...finished, ...remainingResults];
}

export function validateCompilationResultsOrThrow(
  buildDir: string,
  results: CompilationResult[],
): CompiledPackages {
  const failures = results.filter(isCompilationFailure);
  if (failures.length > 0) {
    failures.forEach((failure) => {
      core.error(
        `Failed to compile test for package ${failure.pkg.importPath}: ${failure.error.message}`,
      );
      if (core.isDebug()) {
        const { stdout, stderr } = failure.error;
        if (stdout) core.debug(`stdout (${failure.pkg.importPath}): ${stdout}`);
        if (stderr) core.debug(`stderr (${failure.pkg.importPath}): ${stderr}`);
      }
    });
    throw new Error("Failed to compile test binaries");
  }

  const successes = results.filter(isCompilationSuccess);
  return filterForBuiltBinaries(buildDir, successes);
}

function filterForBuiltBinaries(
  buildDir: string,
  successes: CompilationSuccess[],
) {
  core.info(`Filtering ${successes.length} compilations for binaries.`);

  core.debug(`Reading binaries from ${buildDir}`);
  const binaries = readdirSync(buildDir).filter((file) =>
    file.endsWith("-test"),
  );

  core.info(`Found ${binaries.length} binaries in output directory.`);
  core.debug(`Binaries: ${binaries.join("\n")}`);

  // Filter out any successes where the binary doesn't exist.
  // This occurs if the package has no tests.
  const compiledPackages: CompiledPackages = {};
  for (const success of successes) {
    if (
      verifyBinaryExistsOrThrow(
        success.output.binary,
        success.pkg.importPath,
        success.execution.stdout,
      )
    ) {
      const value = {
        importPath: success.pkg.importPath,
        directory: success.pkg.directory,
        compile: {
          binary: success.output.binary,
          log: success.output.log,
          execution: {
            command: success.execution.command,
            exitCode:
              success.execution.exitCode !== undefined
                ? success.execution.exitCode
                : -1,
            durationMs: success.execution.durationMs,
            cwd: success.execution.cwd,
          },
        },
      };

      insertWithoutDuplicates(success.pkg.importPath, value, compiledPackages);
    }
  }

  const keys = Object.keys(compiledPackages);
  if (keys.length !== binaries.length) {
    core.error(`Expected ${binaries.length} binaries, found ${keys.length}`);
  }

  return compiledPackages;
}

export function verifyBinaryExistsOrThrow(
  binaryPath: string,
  importPath: string,
  stdout: string,
) {
  core.debug(`Verifying Package: ${importPath}, Binary: ${binaryPath}`);

  if (existsSync(binaryPath)) {
    return true;
  }

  // If the binary doesn't exist, check if the package has no tests.
  if (stdout.startsWith("?") && stdout.includes("[no test files]")) {
    core.debug(`No tests for package ${importPath}`);
    return false;
  }

  // If the binary doesn't exist and the package has tests, throw an error.
  throw new Error(
    `Binary not found when expected. Package: ${importPath} , Binary: ${binaryPath}`,
  );
}
