import { existsSync, readdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";
import pLimit from "p-limit";

import { GoPackage, CompiledPackages, LocalPackages } from "./index.js";
import { insertWithoutDuplicates } from "../utils.js";

const defaultExecaOptions = {
  cwd: "",
  all: true,
  stdout: "pipe",
  stderr: "pipe",
} satisfies ExecaOptions;
export type ExecaOptions = {
  cwd: string;
  all: true;
  stdout: "pipe";
  stderr: "pipe";
};
export type ExecaReturn = Awaited<ReturnType<typeof execa<ExecaOptions>>>;
type CompilationResult = CompilationSuccess | CompilationFailure;
export type CompilationSuccess = {
  output: {
    binary: string;
    log: string;
  };
  pkg: GoPackage;
  execution: ExecaReturn;
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
  return execa(cmd, flags, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    all: true,
  } satisfies ExecaOptions);
}
export async function compileTestBinary(
  cwd: string,
  outputDir: string,
  { importPath, directory }: GoPackage,
  buildFlags: string[],
): Promise<CompilationResult> {
  const filename = importPath.replace(/\//g, "-") + "-test";
  const binPath = path.join(outputDir, filename);

  const logPath = path.join(outputDir, filename + ".compile.log");
  const outputStream = createWriteStream(logPath);

  try {
    const cmd = "go";
    const flags = ["test", "-c", "-o", binPath, ...buildFlags, importPath];
    core.debug(`Exec: ${cmd} ${flags.join(" ")} (cwd: ${cwd})`);

    const subprocess = execa(cmd, flags, {
      ...defaultExecaOptions,
      cwd,
    } satisfies ExecaOptions);
    core.debug(`Logging output to ${logPath}`);

    subprocess.all?.pipe(outputStream);

    const execution = await subprocess;
    return {
      output: {
        binary: binPath,
        log: logPath,
      },
      pkg: { importPath, directory },
      execution,
    } as CompilationSuccess;
  } catch (error) {
    core.setFailed(`Failed to compile test for package ${importPath}`);
    if (!(error instanceof ExecaError)) {
      throw error;
    }

    return {
      output: {
        binary: binPath,
        log: logPath,
      },
      pkg: { importPath, directory },
      error,
    } as CompilationFailure;
  }
}
export async function compileConcurrent(
  workingDir: string,
  outputDir: string,
  packages: LocalPackages,
  buildFlags: string[],
  collectCoverage: boolean,
  maxConcurrency: number,
) {
  const limit = pLimit(maxConcurrency);

  const values = Object.values(packages);
  const building = new Set<string>();
  const tasks = values.map((pkg) =>
    limit(() => {
      building.add(pkg.importPath);
      return compileTestBinary(workingDir, outputDir, pkg, buildFlags).finally(
        () => building.delete(pkg.importPath),
      );
    }),
  );

  const interval = setInterval(() => {
    const remaining = limit.pendingCount + limit.activeCount;
    const completed = values.length - remaining;
    core.info(
      `${completed}/${values.length} builds completed. Active: ${limit.activeCount}, Pending: ${limit.pendingCount}`,
    );
    if (remaining < 10) {
      core.info(
        `Remaining builds:\n   - ${Array.from(building).join("\n   - ")}`,
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
