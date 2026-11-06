import * as core from "@actions/core";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

export const WORKFLOW_LOCKFILE_PATH = ".github/workflows/actions.lock";

// Matches the official parser's limit so we reject oversized files before
// reading them into memory.
const MAX_LOCKFILE_SIZE = 1 << 20;

export interface WorkflowLockfile {
  version?: string;
  workflows: Record<string, string[]>;
}

export interface LockfileParseError {
  message: string;
  line?: number;
  column?: number;
  futureVersion?: boolean;
}

export interface LockfileReadResult {
  lockfile?: WorkflowLockfile;
  error?: LockfileParseError;
}

interface ParseResponse {
  ok: boolean;
  version?: string;
  workflows?: Record<string, string[]>;
  error?: string;
  line?: number;
  column?: number;
  futureVersion?: boolean;
}

interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

type GoConstructor = new () => GoRuntime;

interface LockfileGlobals {
  Go?: GoConstructor;
  parseLockfile?: (contents: string) => string;
}

let parserPromise: Promise<(contents: string) => ParseResponse> | undefined;

/**
 * Reads and validates the workflow dependency lockfile with the official Go
 * parser compiled to WebAssembly.
 */
export async function readWorkflowLockfile(
  rootDir: string,
): Promise<LockfileReadResult> {
  const lockfilePath = join(rootDir || process.cwd(), WORKFLOW_LOCKFILE_PATH);

  let size: number;
  try {
    size = statSync(lockfilePath).size;
  } catch (error: any) {
    if (error.code === "ENOENT") return {};
    return {
      error: {
        message: `Unable to read workflow lockfile at ${lockfilePath}: ${error.message}`,
      },
    };
  }

  if (size > MAX_LOCKFILE_SIZE) {
    return {
      error: {
        message: `Workflow lockfile at ${lockfilePath} is ${size} bytes; the maximum is ${MAX_LOCKFILE_SIZE}.`,
      },
    };
  }

  let content: string;
  try {
    content = readFileSync(lockfilePath, "utf-8");
  } catch (error: any) {
    return {
      error: {
        message: `Unable to read workflow lockfile at ${lockfilePath}: ${error.message}`,
      },
    };
  }

  const result = await parseWorkflowLockfileContents(content);
  if (result.lockfile) {
    core.info(
      `Loaded workflow lockfile with ${Object.keys(result.lockfile.workflows).length} onboarded workflow(s).`,
    );
  }

  return result;
}

/**
 * Exported for tests. Parses lockfile contents with the official parser.
 */
export async function parseWorkflowLockfileContents(
  contents: string,
): Promise<LockfileReadResult> {
  try {
    const parse = await getLockfileParser();
    const result = parse(contents);

    if (!result.ok) {
      return {
        error: {
          message: result.error ?? "Invalid workflow lockfile",
          line: result.line,
          column: result.column,
          futureVersion: result.futureVersion,
        },
      };
    }

    return {
      lockfile: {
        version: result.version,
        workflows: result.workflows ?? {},
      },
    };
  } catch (error: any) {
    return {
      error: {
        message: `Unable to load the workflow lockfile parser: ${error.message}`,
      },
    };
  }
}

/**
 * Normalizes a filename to the repository-relative form used as a key in the
 * lockfile's `workflows` section. Handles paths that still carry a `./` prefix
 * or an absolute path rooted at the workspace.
 */
export function normalizeWorkflowPath(
  filename: string,
  rootDir?: string,
): string {
  let normalized = filename;

  if (rootDir && isAbsolute(normalized)) {
    normalized = relative(rootDir, normalized);
  }

  normalized = normalized.replace(/\\/g, "/");

  while (normalized.startsWith("./")) {
    normalized = normalized.substring(2);
  }

  return normalized;
}

/**
 * Returns the action references locked for a workflow, or undefined when the
 * workflow is not onboarded to the lockfile.
 */
export function getLockedActionRefs(
  lockfile: WorkflowLockfile | undefined,
  filename: string,
  rootDir?: string,
): string[] | undefined {
  if (!lockfile) return;

  const workflowPath = normalizeWorkflowPath(filename, rootDir);
  if (!Object.prototype.hasOwnProperty.call(lockfile.workflows, workflowPath)) {
    return;
  }

  return lockfile.workflows[workflowPath];
}

/**
 * Builds the repo-scoped pin key used by the lockfile. Owner and repo are
 * case-insensitive; the ref preserves case. Sub-action paths are not part of a
 * pin, so `actions/cache/save@v4` matches `actions/cache@v4`.
 */
export function toActionPinKey(
  owner: string,
  repo: string,
  ref: string,
): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}@${ref}`;
}

async function getLockfileParser(): Promise<
  (contents: string) => ParseResponse
> {
  parserPromise ??= loadLockfileParser();
  return parserPromise;
}

async function loadLockfileParser(): Promise<
  (contents: string) => ParseResponse
> {
  const wasmExecPath = findArtifact("wasm_exec.js");
  const wasmPath = findArtifact("lockfile.wasm");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(wasmExecPath);

  const globals = globalThis as typeof globalThis & LockfileGlobals;
  const Go = globals.Go;
  if (!Go) {
    throw new Error("wasm_exec.js did not define the Go runtime");
  }

  const go = new Go();
  const wasm = readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(wasm, go.importObject);

  go.run(instance).catch((error) => {
    core.error(`Workflow lockfile parser stopped: ${error}`);
  });

  const parse = await waitForLockfileParser(globals);
  return parse;
}

async function waitForLockfileParser(
  globals: typeof globalThis & LockfileGlobals,
): Promise<(contents: string) => ParseResponse> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (typeof globals.parseLockfile === "function") {
      return (contents) => JSON.parse(globals.parseLockfile!(contents));
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for the workflow lockfile parser");
}

function findArtifact(name: string): string {
  const candidates = [
    __dirname,
    join(__dirname, "..", "dist"),
    join(process.cwd(), "dist"),
  ];

  for (const directory of candidates) {
    const artifact = join(directory, name);
    if (existsSync(artifact)) return artifact;
  }

  throw new Error(
    `Unable to find ${name}. Run \`pnpm nx run gha-workflow-validator:build\` to build the WASM parser.`,
  );
}
