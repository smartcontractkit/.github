import { execSync } from "child_process";
import { dirname, sep } from "path";
import { readFileSync } from "fs";
import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { isPseudoVersion, pseudoVersionRev } from "./pseudo-version";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Origin: any;
  Reuse: boolean;
}

interface ModuleError {
  Err: string;
}

export interface BaseGoModule {
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
   * The repo owner of the dependency.
   */
  owner: string;

  /**
   * The repo name of the dependency.
   */
  repo: string;

  /**
   * The path to the go.mod file describing the module.
   *
   * Not to be confused with "path", which is the module path, like github.com/smartcontractkit/go-proxy.
   * @example /path/to/go.mod
   */
  goModFilePath: string;
}

export interface GoModuleWithCommitSha extends BaseGoModule {
  commitSha: string;
}

export interface GoModuleWithTag extends BaseGoModule {
  tag: string;
}

export type GoModule = GoModuleWithCommitSha | GoModuleWithTag | BaseGoModule;

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
export async function getAllGoModsWithin(goModDir: string): Promise<string[]> {
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
      const output = execSync("go list -json -e -m all", {
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
  return function getDepPath({
    goModFilePath,
    path,
    name,
  }: BaseGoModule): number {
    core.debug(
      `Finding line number for ${path} in ${goModFilePath}. (${name})`,
    );
    if (!cache[goModFilePath]) {
      cache[goModFilePath] = readFileSync(goModFilePath, "utf-8")
        .split("\n")
        .map((l) => l.trim());
    }

    let line = -1;
    for (let i = 0; i < cache[goModFilePath].length; i++) {
      // HACK: We add a space after the depPath to avoid matching substrings.
      if (cache[goModFilePath][i].includes(path + " ")) {
        if (line !== -1) {
          core.warning(
            `Duplicate dependency path found: ${path} in ${goModFilePath} (line ${i + 1}). Previously found on line ${line}. Annotations may be faulty. Skipping.`,
          );
          continue;
        }
        line = i + 1;
      }
    }

    if (line === -1) {
      throw new Error(`dependency path not found: ${path}`);
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
    .map((d: GoMod): GoModule => {
      // repo format github.com/smartcontractkit/chainlink
      const [_, owner, repo, ...subModulePathElements] = d.Path.split("/");
      const baseModule: BaseGoModule = {
        owner,
        repo,
        goModFilePath,
        name: `${d.Path}@${d.Version}${d.Indirect ? " // indirect" : ""}`,
        path: d.Path,
        version: d.Version,
      };

      const versionType = getVersionType(d.Version);

      if (!versionType.tag && !versionType.commitSha) {
        core.warning(
          `invalid version string: ${d.Version} for module: ${d.Path}`,
        );
        return baseModule;
      } else if (versionType.commitSha) {
        return {
          ...baseModule,
          commitSha: versionType.commitSha,
        };
      } else {
        // sub-modules can only use git tags prefixed with their sub-module path (this is a Go requirement)
        // the go list output is deceiving because it shows the version as the tag without the sub-module path prefix
        // e.g. the dependency: github.com/smartcontractkit/chainlink-protos/cre/go v1.0.0-beta
        //   - this will show "Version" as "v1.0.0-beta"
        //   - but the actual tag in git is cre/go/v1.0.0-beta
        const subModulePath = subModulePathElements.join("/");
        const gitTag = subModulePath
          ? `${subModulePath}/${versionType.tag}`
          : versionType.tag;
        return {
          ...baseModule,
          tag: gitTag,
        };
      }
    });

  return goModules;
}

/**
 * Extracts the type of a given version string.
 *
 * @param versionString - The version string to extract the type from.
 *
 * A pseudo version is a version string that is generated by Go when a module is built from a commit that is not tagged. Thus, they are generated from commit data.
 * See: https://go.dev/ref/mod#pseudo-versions for more details.
 *
 * A regular version is a version string that is a tag.
 *
 */
export function getVersionType(versionString: string) {
  if (isPseudoVersion(versionString)) {
    return {
      commitSha: pseudoVersionRev(versionString),
      tag: undefined,
    };
  }

  // matches real versions like v0.1.0, v1.0.0-beta, v3.0.0-rc.6
  const semverTagRe = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
  const versionMatch = versionString.match(semverTagRe);
  if (versionMatch) {
    return {
      commitSha: undefined,
      tag: versionString,
    };
  }

  return {
    commitSha: undefined,
    tag: undefined,
  };
}
