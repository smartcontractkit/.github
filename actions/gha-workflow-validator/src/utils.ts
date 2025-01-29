import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { sep } from "path";

/**
 * Gets all workflow and action files in the specified directory and subdirectories.
 * @param directory The root directory to search for workflow and action files
 * @param allActionDefinitions Whether to include all action definitions or just those in the .github directory
 * @returns Array of file paths to the workflow and action files
 */
export async function getAllWorkflowAndActionFiles(
  directory: string,
  allActionDefinitions: boolean,
): Promise<string[]> {
  core.debug(`Getting all workflow and action files in ${directory}`);

  const workflowPatterns = [
    `${directory}/.github/workflows/*.yml`,
    `${directory}/.github/workflows/*.yaml`,
  ];

  const actionPatterns = allActionDefinitions
    ? [
        `${directory}/**/action.yml`,
        `${directory}/**/action.yaml`,
        `${directory}/action.yml`,
        `${directory}/action.yaml`,
      ]
    : [
        `${directory}/.github/actions/**/action.yml`,
        `${directory}/.github/actions/**/action.yaml`,
      ];

  return await globFiles([...workflowPatterns, ...actionPatterns]);
}

async function globFiles(patterns: string[]): Promise<string[]> {
  let files: string[] = [];

  try {
    for (const pattern of patterns) {
      const globber = await glob.create(pattern, {
        followSymbolicLinks: false,
      });
      const matchedFiles = await globber.glob();

      core.debug(`Matched files for ${pattern}: ${matchedFiles.length}`);

      const noPrefixMatchedFiles = matchedFiles.map((f) =>
        f.replace(`${process.cwd()}${sep}`, `.${sep}`),
      );
      files = files.concat(noPrefixMatchedFiles);
    }

    return files;
  } catch (error) {
    core.error(`Failed to get paths: ${error}`);
  }

  return [];
}
