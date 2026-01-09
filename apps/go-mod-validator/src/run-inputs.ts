import * as core from "@actions/core";

export const CL_LOCAL_DEBUG = process.env.CL_LOCAL_DEBUG === "true";

export interface RunInputs {
  githubToken: string;
  githubPrReadToken: string;
  goModDir: string;
  depPrefix: string;
  repoBranchExceptions: Map<string, string[]>;
}

export function getInputs(): RunInputs {
  core.info("Getting inputs for run.");

  const githubToken = getRunInputString("githubToken");

  const inputs: RunInputs = {
    githubToken,
    githubPrReadToken: getRunInputString("githubPrReadToken", githubToken),
    goModDir: getRunInputString("goModDir"),
    depPrefix: getRunInputString("depPrefix"),
    repoBranchExceptions: getRunInputRepoBranchExceptions(
      "repoBranchExceptions",
    ),
  };

  logInputs(inputs);
  return inputs;
}

function logInputs(inputs: RunInputs) {
  core.info("Run Inputs:");
  core.info(`  githubToken: [REDACTED] (non-empty: ${!!inputs.githubToken})`);
  core.info(
    `  githubPrReadToken: [REDACTED] (non-empty: ${!!inputs.githubPrReadToken})`,
  );
  core.info(`  goModDir: ${inputs.goModDir}`);
  core.info(`  depPrefix: ${inputs.depPrefix}`);
  core.info(
    `  repoBranchExceptions: ${JSON.stringify(
      Array.from(inputs.repoBranchExceptions.entries()),
    )}`,
  );
}

interface RunInputConfiguration {
  /**
   * The parameter name as defined in the action.yml file.
   */
  parameter: string;
  /**
   * The local environment variable name to use when debugging locally.
   * This is typically the parameter name with dashes replaced by underscores.
   * For example, "directory" becomes "DIRECTORY". foo-bar becomes FOO_BAR.
   */
  localParameter: string;
}

const runInputsConfiguration: {
  [K in keyof RunInputs]: RunInputConfiguration;
} = {
  githubToken: {
    parameter: "github-token",
    localParameter: "GITHUB_TOKEN",
  },
  githubPrReadToken: {
    parameter: "github-pr-read-token",
    localParameter: "GITHUB_PR_READ_TOKEN",
  },
  goModDir: {
    parameter: "go-mod-dir",
    localParameter: "GO_MOD_DIR",
  },
  depPrefix: {
    parameter: "dep-prefix",
    localParameter: "DEP_PREFIX",
  },
  repoBranchExceptions: {
    parameter: "repo-branch-exceptions",
    localParameter: "REPO_BRANCH_EXCEPTIONS",
  },
};

function getRunInputString(input: keyof RunInputs, defaultValue = "") {
  const defaulted = defaultValue !== "";
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required: !defaulted,
  });

  if (defaulted && !inputValue) {
    return defaultValue;
  }

  return inputValue;
}

function getInputKey(input: keyof RunInputs) {
  const config = runInputsConfiguration[input];
  if (!config) {
    // this should never happen due to type safety
    throw new Error(`No configuration found for input: ${input}`);
  }

  // Use local debug input key if local debugging is enabled
  const inputKey = CL_LOCAL_DEBUG ? config.localParameter : config.parameter;
  return inputKey;
}

/**
 * Note: Exported for testing purposes.
 */
export function getRunInputRepoBranchExceptions(
  input: keyof RunInputs,
): Map<string, string[]> {
  const inputKey = getInputKey(input);
  const inputValue = core.getInput(inputKey, {
    required: false,
  });
  if (!inputValue) {
    return new Map();
  }

  const lines = splitAndTrim(inputValue, "\n");
  if (lines.length === 0) {
    return new Map();
  }

  const repoBranchMap: Map<string, string[]> = new Map();
  for (const line of lines) {
    const [repo, branches] = parseRepoBranchLine(line);
    if (branches.length === 0) {
      core.warning(`No valid branches found in line: ${line}`);
      continue;
    }
    addOrAppendMapValue(repoBranchMap, repo, branches);
  }

  return repoBranchMap;
}

function parseRepoBranchLine(line: string): [string, string[]] {
  const [repo, ...rest] = line.split(":").map((s) => s.trim());
  if (!repo) {
    throw new Error(`Invalid repo in line: ${line}`);
  }
  if (rest.length === 0) {
    throw new Error(`No branch in line: ${line}`);
  }
  if (rest.length > 1) {
    throw new Error(`Multiple colons found in line: ${line}`);
  }
  const branches = splitAndTrim(rest[0], ",");
  return [repo, branches];
}

function splitAndTrim(s: string, separator: string): string[] {
  return s
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function addOrAppendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V[]) {
  if (map.has(key)) {
    map.get(key)!.push(...value);
  } else {
    map.set(key, value);
  }
}
