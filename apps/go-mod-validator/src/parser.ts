const smartContractKitPrefix = "github.com/smartcontractkit/";

function parseGoModLine(line: string) {
  // Trim any extra whitespace
  line = line.trim();

  // Go modules have psuedo versions and real versions
  // 1. psuedo version: v1.1.1-0.20190123174540-a2c9a5303de7
  // 2. real versions: v1.0.2
  // also, there can be pre-release versions
  // 1. v1.1.1-0.20190123174540-a2c9a5303de7+incompatible
  // 2. v1.0.2-beta
  // more details on - https://go.dev/doc/modules/version-numbers
  const moduleRegex = new RegExp(
    /^([\w.-]+(?:\/[\w.-]+)*) (v\d+\.\d+\.\d+(?:-[\w\d.-]+)?(?:\+[\w\d.-]+)?)$/,
  );
  const replaceRegex = new RegExp(
    moduleRegex.source.slice(0, moduleRegex.source.length - 1) +
      " => " +
      moduleRegex.source.slice(1),
  );
  const moduleMatch = line.match(moduleRegex);
  const replaceMatch = line.match(replaceRegex);

  if (moduleMatch) {
    const [, module, version] = moduleMatch;
    return {
      module,
      version,
    };
  }

  if (replaceMatch) {
    const [, , , module, version] = replaceMatch;
    return {
      module,
      version,
    };
  }

  return null;
}

// extract all final dependencies
function parseGoModLines(lines: string[]) {
  const dependencies: { module: string; version: string }[] = [];

  // exclude the first line which is module information
  lines = lines.slice(1);

  // parse each line to find out the final dependency
  lines.forEach((line) => {
    if (line.length == 0) {
      return;
    }

    const result = parseGoModLine(line);
    if (result) {
      console.debug(
        `Parsed Module: ${result.module}, Version: ${result.version}`,
      );
      dependencies.push(result);
    } else {
      console.error(`Could not parse line: ${line}`);
      throw new Error(`Could not parse line: ${line}`);
    }
  });

  return dependencies;
}

// extract only smartcontractkit dependencies
export function getSmartcontractkitDependencies(goListOutputContent: string) {
  // Split the content into lines
  const lines = goListOutputContent.split("\n");

  const dependencies: { module: string; version: string }[] = [];
  parseGoModLines(lines).forEach((dependency) => {
    if (dependency.module.startsWith(smartContractKitPrefix)) {
      dependencies.push(dependency);
    }
  });

  return dependencies;
}
