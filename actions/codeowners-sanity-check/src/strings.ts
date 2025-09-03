import * as core from "@actions/core";
import { CodeOwnersError } from "./github";

export function getNoCodeownersFoundMessage(actor: string): string {
  return `
### No CODEOWNERS file detected - @${actor}

This repository doesn't contain a CODEOWNERS file. Please add one at one of the following paths:
1. \`CODEOWNERS\` (root of repository)
2. \`.github/CODEOWNERS\`

If this repository is owned/used by a single team the default entry for a CODEOWNERS would be:

\`\`\`
* @smartcontractkit/<your team>
\`\`\`

For more information see: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
`;
}

export function getSuccessfulCodeownersMessage(actor: string) {
  return `Thank you for adding a CODEOWNERS file - @${actor}.`;
}

export function annotateErrors(errors: CodeOwnersError[]): void {
  for (const e of errors) {
    // Prefer e.path when provided, otherwise default to CODEOWNERS
    const file = e.path || "CODEOWNERS";
    const title = e.kind || "CODEOWNERS error";

    const message = e.suggestion || e.message;

    core.error(message?.trim() || title, {
      file,
      startLine: e.line,
      startColumn: e.column,
      title,
    });
  }
}

export function getInvalidCodeownersMessage(
  actor: string,
  numErrors: number,
  summaryUrl: string,
) {
  const workflowSummary =
    summaryUrl !== ""
      ? `[workflow summary](${summaryUrl})`
      : "workflow summary";

  return `
### Invalid CODEOWNERS file detected - @${actor}.

${numErrors} error(s) were found in the CODEOWNERS file.

See the ${workflowSummary} and PR annotations for more information.
`;
}

export function generateMarkdownTableVerbose(
  errors: CodeOwnersError[],
): string {
  if (!errors.length) {
    return "_No CODEOWNERS errors found._";
  }

  // Basic escaping for pipes to keep table formatting stable
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n/g, " ");

  const header =
    "### CODEOWNERS Errors\n\n" +
    "| Path | Line:Col | Kind | Message | Suggestion |\n|---|---|---|---|---|";

  const rows = errors.map((e) => {
    const where = `${e.line}:${e.column}`;
    return `| ${esc(e.path || "CODEOWNERS")} | ${esc(where)} | ${esc(
      e.kind || "Error",
    )} | ${esc(e.message)} | ${esc(e.suggestion || "")} |`;
  });

  return [header, ...rows].join("\n");
}
