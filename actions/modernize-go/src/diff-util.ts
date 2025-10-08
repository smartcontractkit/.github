import * as core from "@actions/core";
import simpleGit, { SimpleGit } from "simple-git";
import gitDiffParser from "gitdiff-parser";

import type { File } from "gitdiff-parser";
import type { PRReviewComment } from "./github";


/** Normalizes repo-relative paths to forward slashes without leading './' */
const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\/+/, "");

/**
 * 1) Get the local unified diff of the working tree (vs HEAD by default).
 *    If you staged the changes, pass { staged: true } to diff the index instead.
 */
export async function getLocalDiff(
  baseDir = process.cwd(),
  additionalArgs?: string[],
) {
  core.info(`Getting local diff in ${baseDir}`);

  const git: SimpleGit = simpleGit({ baseDir });
  // Tight hunks make suggestion mapping easier
  const baseArgs = [`--unified=0`];
  const args =  [...baseArgs, ...(additionalArgs || [])];

  const diffText = (await git.diff(args)).trim();

  const parsedDiff = gitDiffParser.parse(diffText);
  core.info(`Local diff contains ${parsedDiff.length} file(s) with changes.`);

  return parsedDiff;
}


/**
 * 2) Filter a unified diff string to only include files that appear
 *    in the provided PR-modified file list. Returns parsed file objects.
 *
 * @param diffText unified diff (e.g., from getLocalDiff)
 * @param prModifiedFiles repo-relative paths modified by the PR
 */
export function filterLocalDiffToPRFiles(
  files: File[],
  prModifiedFiles: string[]
) {
  const allow = new Set(prModifiedFiles.map(norm));

  // Keep only files that are both in the local diff AND in the PR’s changed set
  const filtered = files.filter((f) => {
    // parser uses oldPath/newPath like "a/foo.go", "b/foo.go" or plain "foo.go"
    const candidates = [f.newPath, f.oldPath]
      .filter(Boolean)
      .map((p) => norm(String(p).replace(/^a\//, "").replace(/^b\//, "")));
    return candidates.some((c) => allow.has(c));
  });

  return filtered;
}

/**
 * 3) Create GitHub review suggestion comments from parsed and filtered file diffs.
 *
 * Produces entries compatible with `octokit.rest.pulls.createReview({ comments: [...] })`.
 * Strategy:
 *  - For hunks where oldLines > 0, create a replace-style suggestion using the hunk’s added lines.
 *  - Skips insert-only hunks (oldLines === 0) and binary files.
 *  - Uses the PR HEAD side ("RIGHT") coordinates with start_line/line for multi-line ranges.
 */
export function createSuggestionCommentsFromDiff(parsedFiles: ReturnType<typeof gitDiffParser.parse>): PRReviewComment[] {
  const comments: PRReviewComment[] = [];

  for (const file of parsedFiles) {
    // Skip binary/deleted files if the parser exposes that state
    // (gitdiff-parser sets `isBinary` on file if detectable)
    if ((file as any).isBinary) continue;

    const relPath = norm(
      String(file.newPath ?? file.oldPath ?? "").replace(/^b\//, "").replace(/^a\//, "")
    );
    if (!relPath) continue;

    for (const hunk of file.hunks) {
      // Gather the “added” lines to form the replacement suggestion
      const addedLines = hunk.changes
        .filter((c) => c.type === "insert" || c.type === "normal") // some parsers differentiate
        .map((c) => c.content.replace(/^\+/, "")); // safety if content includes raw prefix

      // Count how many old (deleted or replaced) lines are in this hunk
      const oldLineCount = hunk.changes.filter((c) => c.type === "delete").length;

      // We only emit suggestions when there is something to replace
      // (oldLines > 0 ensures we’re replacing an existing range)
      const oldLines = hunk.oldLines ?? oldLineCount;
      const oldStart = hunk.oldStart;

      if (!oldStart || !oldLines || oldLines <= 0) {
        // Insert-only hunks: you can extend this by anchoring to an adjacent context line
        continue;
      }

      const start = oldStart;
      const end = oldStart + oldLines - 1;

      const body = "```suggestion\n" + addedLines.join("\n") + "\n```";

      comments.push({
        path: relPath,
        body,
        start_line: start,
        line: end,
        side: "RIGHT",
        start_side: "RIGHT",
      });
    }
  }

  return comments;
}
