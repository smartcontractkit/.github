import { execSync } from "child_process";
import { dirname, sep } from "path";
import { readFileSync } from "fs";
import * as core from "@actions/core";
import * as glob from "@actions/glob";

/**
 * Taken from `go help list` for the command `go list -json -m all`
 *  @link https://pkg.go.dev/cmd/go#hdr-List_packages_or_modules
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
   * The name of the module is the path + version of the module,
   * along with a postfix of "// indirect" indicating if the module is indirect.
   */
  name: string;
  /**
   * Module path
   */
  path: string;
  /**
   * Module version
   */
  version: string;

  /**
   * The path to the go.mod file describing the module.
   *
   * Not to be confused with "path", which is the module path, like github.com/smartcontractkit/go-proxy.
   * @example /path/to/go.mod
   */

  goModFilePath: string;
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
 * Recursively gets the paths of all go.mod files in the specified directory.
 *
 * @param goModDir The directory to search for go.mod files.
 *
 * @throws If no go.mod files are found or an error occurs.
 */
async function getAllGoModsWithin(goModDir: string): Promise<string[]> {
  let files: string[] = [];
  const pattern = `${goModDir}/**/go.mod`;
  try {
    const globber = await glob.create(pattern);
    files = await globber.glob();
    files = files.map((f) => f.replace(`${process.cwd()}${sep}`, `.${sep}`));
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  }

  if (files.length == 0) {
    throw new Error(
      `no go.mod files found with pattern ${pattern} and cwd ${process.cwd()}`,
    );
  }
  return files;
}

/**
 * Gets all the dependencies of the Go modules in the specified directory.
 *
 * We recursively collect all go.mod files within a directory, then return the flattened list of all dependencies.
 * There may be duplicates in the list, but we don't care about that.
 *
 * Dependencies are filtered by depPrefix.
 *
 * @param rootDir The directory containing the Go modules.
 *
 */
export async function getDeps(
  rootDir: string,
  depPrefix: string,
): Promise<GoModule[]> {
  const modFilePaths = await getAllGoModsWithin(rootDir);

  const deps = modFilePaths.flatMap((goModFilePath) => {
    core.info(`Finding dependencies in ${goModFilePath}`);
    try {
      const dir = dirname(goModFilePath);
      const output = execSync("go list -json -m all", {
        encoding: "utf-8",
        cwd: dir,
      });
      core.debug(`Raw output: ${output}`);
      const parsedDeps = parseGoModListOutput(output);
      core.debug(`Parsed dependencies: ${JSON.stringify(parsedDeps)}`);
      const mappedDeps = goModsToGoModules(
        goModFilePath,
        parsedDeps,
        depPrefix,
      );
      core.debug(`Mapped dependencies: ${JSON.stringify(mappedDeps)}`);
      return mappedDeps;
    } catch (error) {
      throw Error(
        `failed to get go.mod dependencies from file: ${goModFilePath}, err: ${error}`,
      );
    }
  });

  return deps;
}

/**
 * Creates a function that finds the line number of a dependency path in a go.mod file.
 */
export function lineForDependencyPathFinder() {
  const cache: {
    // goModPath -> [go mod file lines]
    [goModPath: string]: string[];
  } = {};

  /**
   * Given a go.mod file path and a dependency path, returns the line number of the dependency path in the go.mod file.
   *
   * We assume that you cannot have two modules of the same name in the go.mod file.
   * Technically, you can, but you need to make use of the replace directive along with two copies of the same module locally in order to do so.
   * This seems to be a rare case, so we are not handling it.
   *
   * @param goModPath The path to the go.mod file. E.g. /path/to/go.mod
   * @param depPath The dependency path to search for in the go.mod file. E.g. github.com/smartcontractkit/go-proxy
   *
   * @throws If the dependency path is found more than once in the go.mod file.
   */
  return function getDepPath(goModPath: string, depPath: string): number {
    if (!cache[goModPath]) {
      cache[goModPath] = readFileSync(goModPath, "utf-8").split("\n");
    }

    let line = -1;
    for (let i = 0; i < cache[goModPath].length; i++) {
      if (cache[goModPath][i].includes(depPath)) {
        if (line !== -1) {
          throw new Error(`duplicate dependency path found: ${depPath}`);
        }
        line = i + 1;
      }
    }

    if (line === -1) {
      throw new Error(`dependency path not found: ${depPath}`);
    }

    return line;
  };
}

/**
 * Takes the parsed output of `go list -json -m all` and converts it to a list of GoModule objects.
 *
 * Performs the following transformations:
 * - Filters out the main module and non-org dependencies.
 * - Maps the GoMod object to a GoModule object.
 * @param goMods
 */
export function goModsToGoModules(
  goModFilePath: string,
  goMods: GoMod[],
  depPrefix: string,
): GoModule[] {
  const goModules = goMods
    // Replace the module with the Replace field if it exists
    .map((d) => d.Replace || d)
    // `go list -m -json all` also lists the main package, avoid parsing it.
    // and only validate dependencies belonging to our org
    .filter((d) => !d.Main && d.Path.startsWith(depPrefix))
    .map(
      (d: GoMod): GoModule => ({
        goModFilePath,
        name: `${d.Path}@${d.Version}${d.Indirect ? " // indirect" : ""}`,
        path: d.Path,
        version: d.Version,
      }),
    );

  return goModules;
}