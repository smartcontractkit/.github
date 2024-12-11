import * as core from "@actions/core";

import { Inputs } from "./main.js";
import { logSection, logObject } from "./log.js";
import { getTestHashIndex, saveTestHashIndex } from "./github.js";
import { listPackages } from "./pipeline/filter.js";
import {
  compileConcurrent,
  validateCompilationResultsOrThrow,
} from "./pipeline/build.js";
import { comparePackagesToIndex, hashFile } from "./pipeline/hash.js";
import { runConcurrent, validateRunResultsOrThrow } from "./pipeline/run.js";

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

  const localBuildFlags = [...inputs.buildFlags];
  if (inputs.collectCoverage) {
    core.info("Collect coverage enabled. Adding build flags.");
    localBuildFlags.push("-cover", "-coverpkg=./...", "-covermode=atomic");
  }

  const compilationResults = await compileConcurrent(
    inputs.moduleDirectory,
    inputs.buildDirectory,
    packages,
    localBuildFlags,
    inputs.maxBuildConcurrency,
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
 *
 * This step will compare the hashes of the compiled binaries to the index.
 * It pulls the hash index from the repository, then compares the hashes, and sets the 'shouldRun' property.
 *
 * If:
 *   - hash is different from the index, or
 *   - index doesn't have the package, or
 *   - run all tests input is true
 * Then:
 *   - the 'shouldRun' property is set to true, and the package will be run.
 *
 * @param inputs The inputs from the workflow.
 * @param packages The hashed compiled packages to compare, from step 3.
 * @returns DiffedHashedCompiledPackages
 */
export async function processChangedPackages(
  inputs: Inputs,
  packages: HashedCompiledPackages,
): Promise<DiffedHashedCompiledPackages> {
  logSection("Comparing Hashes");

  const hashIndex = await getTestHashIndex(inputs.testSuite);
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
 * The 'run' property is only present if the test binary was executed,
 * which is determined by the 'shouldRun' property, added in the previous step.
 */
interface RunInfo {
  log: string;
  coverage?: string;
  execution: ExecInfo;
}
export interface MaybeExecutedPackages {
  [packageName: string]: HashedCompiledPackages[string] & {
    run?: RunInfo;
  };
}

/**
 * STEP 5: Run Test Binaries
 * Takes in the compared/diffed compiled packages and runs the test binaries.
 * It will run the tests, then validate the results. If any failures are found, it will throw an error.
 * @param inputs The inputs from the workflow.
 * @param packages The diffed compiled packages to run, from step 4.
 * @returns
 */
export async function runTestBinaries(
  inputs: Inputs,
  packages: DiffedHashedCompiledPackages,
): Promise<MaybeExecutedPackages> {
  logSection("Run Tests");
  const coverageDirectory = inputs.collectCoverage
    ? inputs.coverageDirectory
    : "";

  // Default run flags
  const localFlags = ["-test.timeout=10m"];
  if (core.isDebug()) {
    localFlags.push("-test.v");
  }

  const runResults = await runConcurrent(
    inputs.buildDirectory,
    packages,
    localFlags,
    coverageDirectory,
    inputs.maxRunConcurrency,
  );

  return validateRunResultsOrThrow(packages, runResults);
}

/**
 * STEP 6: Update Hash Index.
 * This step will potentially update the hash index with the new hashes of the compiled binaries.
 * It will only update the index if the current branch is the default branch. Unless, force update index is enabled.
 * It will also skip updating the index if coverage collection is enabled, as that effects the hash of the binaries.
 * @param inputs The inputs from the workflow.
 * @param hashedPackages The hashed packages to potentially update the index with.
 * @returns Promise<void>
 */
export async function maybeUpdateHashIndex(
  inputs: Inputs,
  hashedPackages: MaybeExecutedPackages,
) {
  // Skip if coverage was enabled
  const isCoverageEnabled =
    inputs.collectCoverage ||
    Object.values(hashedPackages).some((pkg) => pkg?.run?.coverage);
  if (isCoverageEnabled) {
    core.warning(
      "Coverage collection was enabled. Skipping test hash index update.",
    );
    return;
  }

  logSection("Updating Hash Index");

  const hashes = Object.entries(hashedPackages).reduce(
    (acc, [importPath, pkg]) => {
      acc[importPath] = pkg.hash;
      return acc;
    },
    {} as Record<string, string>,
  );

  await saveTestHashIndex(inputs.testSuite, hashes);
}
