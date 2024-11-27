import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "../main.js";
import { logSection, logObject } from "../log.js";
import { getHashFile, commitTestHashIndex } from "../github.js";
import { listPackages } from "./filter.js";
import {
  compileConcurrent,
  validateCompilationResultsOrThrow,
} from "./build.js";
import { comparePackagesToIndex, hashFile } from "./hash.js";
import { runConcurrent, validateRunResultsOrThrow } from "./run.js";

/**
 * General information from the Execa call.
 */
export interface ExecInfo {
  command: string;
  exitCode: number;
  cwd: string;
  durationMs: number;
}

/**
 * A Go package with an import path and directory.
 * The import path being the package's name, and the directory being the path to the package within the repository.
 *
 * The directory is important because when go executes tests, the CWD is typically the package's directory.
 * When running tests binaries separately, we need to properly set the CWD to the package's directory.
 */
export type GoPackage = { importPath: string; directory: string };

/**
 * The result of filtering which packages are applicable to this event.
 *
 * This is the first step in the processing pipeline.
 */
export interface LocalPackages {
  [packageName: string]: GoPackage;
}

/**
 * STEP 1: Filter Tests
 */
export async function getTestPackages(inputs: Inputs): Promise<LocalPackages> {
  logSection("Locating Packages");
  // if (inputs.tagFilter) {
  //   return findTaggedTestPackages(inputs.moduleDirectory, inputs.tagFilter);
  // }

  return listPackages(inputs.moduleDirectory);
}

/**
 * The result of compiling the filtered packages.
 * Some of these packages contain no tests, and therefore no test binary is outputted.
 * These packages should be filtered out before the next step.
 *
 * This is the second step in the processing pipeline.
 */
interface CompileInfo {
  binary: string;
  log: string;
  execution: ExecInfo;
}
export interface CompiledPackages {
  [packageName: string]: LocalPackages[string] & {
    compile: CompileInfo;
  };
}

/**
 * STEP 2: Build Test Binaries
 */
export async function buildTestBinaries(
  inputs: Inputs,
  packages: LocalPackages,
): Promise<CompiledPackages> {
  logSection("Build Tests");

  const maxBuildConcurrency = parseInt(core.getInput("build-concurrency")) || 4;

  const compilationResults = await compileConcurrent(
    inputs.moduleDirectory,
    inputs.buildDirectory,
    packages,
    inputs.buildFlags,
    inputs.collectCoverage,
    maxBuildConcurrency,
  );

  return validateCompilationResultsOrThrow(
    inputs.buildDirectory,
    compilationResults,
  );
}

/**
 * The result of hashing the compiled packages.
 *
 * This is the third step in the processing pipeline.
 */
export interface HashedCompiledPackages {
  [packageName: string]: CompiledPackages[string] & {
    hash: string;
  };
}

/**
 * STEP 3: Hash Test Binaries
 */
export async function generateHashes(
  compiledPackages: CompiledPackages,
): Promise<HashedCompiledPackages> {
  logSection("Hashing Test Binaries");
  try {
    const testFiles = Object.entries(compiledPackages).map(([key, pkg]) => {
      return { key, binary: pkg.compile.binary };
    });
    core.debug(`Test files: ${testFiles.join(", ")}`);

    const hashedCompiledPackages: HashedCompiledPackages = {};
    for (const { key, binary } of testFiles) {
      const hash = await hashFile(binary);
      hashedCompiledPackages[key] = {
        ...compiledPackages[key],
        hash,
      };
    }

    return hashedCompiledPackages;
  } catch (error) {
    core.error("" + error);
    throw new Error(
      `Error hashing files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * The result of comparing the hashed test binaries to the hash stored in the index.
 *
 * This is the fourth step in the processing pipeline.
 */
export interface DiffedHashedCompiledPackages {
  [packageName: string]: HashedCompiledPackages[string] & {
    indexHash?: string;
    shouldRun: boolean;
  };
}

/**
 * STEP 4: Compare/Filter Test Binaries
 */
export async function processChangedPackages(
  inputs: Inputs,
  packages: HashedCompiledPackages,
): Promise<DiffedHashedCompiledPackages> {
  logSection("Comparing Hashes");

  const hashIndex = await getHashFile(
    github.context.repo.owner,
    github.context.repo.repo,
    inputs.hashesBranch,
    inputs.hashesFile,
  );
  logObject("Remote Hash Index", hashIndex);

  const diffedHashedCompiledPackages = comparePackagesToIndex(
    inputs.runAllTests,
    packages,
    hashIndex,
  );

  return diffedHashedCompiledPackages;
}

/**
 * The result of running the compiled packages.
 * Only successful runs should be included in the final result.
 * Failed runs should will be filtered out and cause the entire process to fail.
 *
 * This is the final step in the processing pipeline.
 */
interface RunInfo {
  log: string;
  execution: ExecInfo;
}
export interface MaybeExecutedPackages {
  [packageName: string]: HashedCompiledPackages[string] & {
    run?: RunInfo;
  };
}

/**
 * STEP 5: Run Test Binaries
 */
export async function runTestBinaries(
  inputs: Inputs,
  packages: DiffedHashedCompiledPackages,
): Promise<MaybeExecutedPackages> {
  logSection("Run Tests");
  const maxRunConcurrency = parseInt(core.getInput("run-concurrency")) || 4;

  const runResults = await runConcurrent(
    inputs.buildDirectory,
    packages,
    [],
    maxRunConcurrency,
  );

  return validateRunResultsOrThrow(packages, runResults);
}

/**
 * STEP 6: Update Hash Index
 */
export async function maybeUpdateHashIndex(
  inputs: Inputs,
  hashedPackages: MaybeExecutedPackages,
) {
  logSection("Updating Hash Index");

  if (inputs.forceUpdateIndex) {
    core.warning("Force update index is enabled. Skipping branch check.");
  } else {
    const defaultBranch = github.context.payload.repository?.default_branch;
    const currentBranch = github.context.ref.replace("refs/heads/", "");
    core.info(
      `Default branch: ${defaultBranch}, Current branch: ${currentBranch}`,
    );

    if (currentBranch !== defaultBranch) {
      core.warning(
        `Current branch (${currentBranch}) is not the default branch (${defaultBranch}). Will not update index.`,
      );
      return;
    }
  }

  const hashes = Object.entries(hashedPackages).reduce(
    (acc, [importPath, pkg]) => {
      if (acc[importPath]) {
        core.warning(`Duplicate hash package found: ${importPath}`);
      }
      acc[importPath] = pkg.hash;
      return acc;
    },
    {} as Record<string, string>,
  );

  await commitTestHashIndex(
    github.context.repo.owner,
    github.context.repo.repo,
    inputs.hashesBranch,
    inputs.hashesFile,
    hashes,
  );
}
