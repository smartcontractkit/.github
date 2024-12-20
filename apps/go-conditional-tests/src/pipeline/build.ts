import { existsSync, readdirSync, createWriteStream } from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { execa, ExecaError } from "execa";
import pLimit from "p-limit";

import { GoPackage, CompiledPackages, LocalPackages } from "../pipeline.js";
import { insertWithoutDuplicates } from "../utils.js";

const defaultExecaOptions = {
  cwd: "",
  all: true,
  stdout: "pipe",
  stderr: "pipe",
} satisfies BuildExecaOptions;
export type BuildExecaOptions = {
  cwd: string;
  all: true;
  stdout: "pipe";
  stderr: "pipe";
};
export type ExecaReturn = Awaited<ReturnType<typeof execa<BuildExecaOptions>>>;
type CompilationResult = CompilationSuccess | CompilationFailure;
export type CompilationSuccess = {
  output: {
    binary: string;
    log: string;
  };
  pkg: GoPackage;
  execution: ExecaReturn;
};

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
    } satisfies BuildExecaOptions);

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

    if (error.stdout) {
      core.info(`${error.stdout}`);
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

/**
 * This is the main entry point for the build/compile step.
 *
 * This function compiles all test binaries with a max concurrency.
 *
 * @param workingDir
 * @param outputDir
 * @param packages
 * @param buildFlags
 * @param collectCoverage
 * @param maxConcurrency
 * @returns
 */
export async function compileConcurrent(
  workingDir: string,
  outputDir: string,
  packages: LocalPackages,
  buildFlags: string[],
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
  const sortedResults = results.sort((a, b) =>
    a.pkg.importPath.localeCompare(b.pkg.importPath),
  );

  const successes: CompilationSuccess[] = [];
  const failures: CompilationFailure[] = [];
  for (const result of sortedResults) {
    if (isCompilationSuccess(result)) {
      successes.push(result);
      // output similar to go test
      core.info(`ok  \t${result.pkg.importPath}\t[build successful]`);
    } else {
      failures.push(result);
      core.info(`FAIL\t${result.pkg.importPath}\t[build failed]`);
    }
  }

  if (failures.length > 0) {
    core.info(`FAIL`);
    throw new Error(`${failures.length} packages failed to compile.`);
  } else {
    core.info(`ok`);
  }

  return filterForBuiltBinaries(buildDir, successes);
}

function filterForBuiltBinaries(
  buildDir: string,
  successes: CompilationSuccess[],
) {
  core.debug(`Filtering ${successes.length} compilations for binaries.`);

  core.debug(`Reading binaries from ${buildDir}`);
  const binaries = readdirSync(buildDir).filter((file) =>
    file.endsWith("-test"),
  );

  core.debug(`Found ${binaries.length} binaries in output directory.`);
  core.debug(`Binaries: ${binaries.join("\n")}`);

  // Filter out any successes where the binary doesn't exist.
  // This occurs if the package has no tests.
  const compiledPackages: CompiledPackages = {};
  for (const success of successes) {
    if (existsSync(success.output.binary)) {
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
    core.warning(
      `Found ${binaries.length} in the output directory, but only found ${keys.length} packages in the results.`,
    );
  }

  return compiledPackages;
}
