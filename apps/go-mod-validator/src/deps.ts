import { execSync } from "child_process";
import { dirname } from "path";
import * as core from "@actions/core";
import * as glob from "@actions/glob";

/**
 * Taken from go help list for the command `go list -json -m all`
 *
 *  type Module struct {
 *        Path       string        // module path
 *        Query      string        // version query corresponding to this version
 *        Version    string        // module version
 *        Versions   []string      // available module versions
 *        Replace    *Module       // replaced by this module
 *        Time       *time.Time    // time version was created
 *        Update     *Module       // available update (with -u)
 *        Main       bool          // is this the main module?
 *        Indirect   bool          // module is only indirectly needed by main module
 *        Dir        string        // directory holding local copy of files, if any
 *        GoMod      string        // path to go.mod file describing module, if any
 *        GoVersion  string        // go version used in module
 *        Retracted  []string      // retraction information, if any (with -retracted or -u)
 *        Deprecated string        // deprecation message, if any (with -u)
 *        Error      *ModuleError  // error loading module
 *        Origin     any           // provenance of module
 *        Reuse      bool          // reuse of old module info is safe
 *    }
 *
 *    type ModuleError struct {
 *        Err string // the error itself
 *    }
 *
 */
interface GoMod {
  Path: string;
  Query: string;
  Version: string;
  Versions: string[];
  Replace?: GoMod;
  Time: Date | null;
  Update?: GoMod;
  Main: boolean;
  Indirect: boolean;
  Dir: string;
  GoMod: string;
  GoVersion: string;
  Retracted: string[];
  Deprecated: string;
  Error: ModuleError | null;
  Origin: any;
  Reuse: boolean;
}

interface ModuleError {
  Err: string;
}
export interface GoModule {
  /**
   * Module path
   */
  path: string;
  /**
   * Module version
   */
  version: string;
}

function parseGoModListOutput(jsonStr: string): GoMod[] {
  /*
   * {
   *   "Path": "github.com/smartcontractkit/libocr",
   *   "Version": "v0.0.0-20240419185742-fd3cab206b2c"
   * }
   * {
   *   "Path": "github.com/smartcontractkit/go-proxy",
   *   "Version": "v0.1.0"
   * }
   */

  // store parsed objects
  const goModules: GoMod[] = [];

  // keep concatenating lines until the object is complete
  let objStr = "";

  // keep track of the depth of the object
  let objDepth = 0;

  // Process
  for (const l of jsonStr.split("\n")) {
    if (l.includes("{")) {
      objDepth++;
    }
    if (l.includes("}")) {
      objDepth--;
    }

    objStr += l;
    if (objDepth === 0 && objStr) {
      goModules.push(JSON.parse(objStr));
      objStr = "";
    }
  }

  return goModules;
}

/**
 * Gets the paths of all go.mod files in the specified directory.
 *
 * @param goModDir The directory to search for go.mod files.
 *
 * @throws If no go.mod files are found or an error occurs.
 */
async function getGoModFiles(goModDir: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const globber = await glob.create(`${goModDir}/**/go.mod`);
    files = await globber.glob();
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  }

  if (files.length == 0) {
    throw new Error("no go.mod files found");
  }
  return files;
}

/**
 * Gets all the dependencies of the Go modules in the specified directory.
 *
 * We recursively collect all go.mod files within a directory, then return the flattened list of all dependencies.
 * There may be duplicates in the list, but we don't care about that.
 *
 * @param rootDir The directory containing the Go modules.
 *
 */
export async function getAllGoModDeps(rootDir: string): Promise<GoMod[]> {
  const modFilePaths = await getGoModFiles(rootDir);

  const deps = modFilePaths.flatMap((p) => {
    core.info(`finding dependencies in ${p}`);
    const dir = dirname(p);
    try {
      const output = execSync("go list -json -m all", {
        encoding: "utf-8",
        cwd: dir,
      });

      return parseGoModListOutput(output);
    } catch (error) {
      throw Error(
        `failed to get go.mod dependencies from file: ${p}: ${error}`,
      );
    }
  });

  return deps;
}
