import * as core from "@actions/core";
import matter from "gray-matter";
import { join } from "path";
import { getGitTopLevel } from "./lib";
import { promises as fs } from "fs";

export async function appendIssueNumberToChangesetFile(
  prefix: string,
  changesetFile: string,
  issueNumber: string,
) {
  const gitTopLevel = await getGitTopLevel();
  const fullChangesetPath = join(gitTopLevel, changesetFile);
  const changesetContents = await fs.readFile(fullChangesetPath, "utf-8");
  // Check if the issue number is already in the changeset file
  if (changesetContents.includes(issueNumber)) {
    core.info("Issue number already exists in changeset file, skipping...");
    return;
  }

  const updatedChangesetContents = `${changesetContents}\n\n${prefix}${issueNumber}`;
  await fs.writeFile(fullChangesetPath, updatedChangesetContents);
}

/**
 * Extracts the list of changeset files. Intended to be used with https://github.com/dorny/paths-filter with
 * the 'csv' output format.
 *
 * @returns An array of strings representing the changeset files.
 * @throws {Error} If the required environment variable CHANGESET_FILES is missing.
 * @throws {Error} If no changeset file exists.
 */
export function extractChangesetFiles(): string[] {
  const changesetFiles = process.env.CHANGESET_FILES;
  if (!changesetFiles) {
    throw Error("Missing required environment variable CHANGESET_FILES");
  }
  const parsedChangesetFiles = changesetFiles.split(",");
  if (parsedChangesetFiles.length === 0) {
    throw Error("At least one changeset file must exist");
  }

  core.info(
    `Changeset to extract issues from: ${parsedChangesetFiles.join(", ")}`,
  );
  return parsedChangesetFiles;
}

/**
 * Extracts a single changeset file. Intended to be used with https://github.com/dorny/paths-filter with
 * the 'csv' output format.
 *
 * @param changesetKey The key to check for in the changeset file.
 * @returns A single changeset file path.
 * @throws {Error} If the required environment variable CHANGESET_FILES is missing.
 * @throws {Error} If no changeset file exists.
 * @throws {Error} If more than one changeset file exists.
 * @throws {Error} If the changeset file does not contain the key passed in.
 */
export async function extractChangesetFile(
  changesetKey: string | undefined,
): Promise<string> {
  const changesetFiles = extractChangesetFiles();
  if (changesetFiles.length > 1) {
    throw new Error(
      `Found ${changesetFiles.length} changeset files, but only 1 was expected.`,
    );
  }
  const gitTopLevel = await getGitTopLevel();
  const fullChangesetPath = join(gitTopLevel, changesetFiles[0]);
  const changesetContents = await fs.readFile(fullChangesetPath, "utf-8");
  const parsed = matter(changesetContents);

  if (!changesetKey) {
    return changesetFiles[0];
  }

  if (!(changesetKey in parsed.data)) {
    throw new Error(
      `Changeset file ${changesetFiles[0]} does not contain the key: ${changesetKey}`,
    );
  }

  return changesetFiles[0];
}
