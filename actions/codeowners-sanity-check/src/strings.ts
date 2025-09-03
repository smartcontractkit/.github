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

export function getInvalidCodeownersMessage(
  actor: string,
  errors: CodeOwnersError[],
) {
  return `
### Invalid CODEOWNERS file detected - @${actor}.

${generateMarkdownTable(errors)}
`;
}

export function annotateErrors(errors: CodeOwnersError[]): void {
  for (const e of errors) {
    // Prefer e.path when provided, otherwise default to CODEOWNERS
    const file = e.path || "CODEOWNERS";
    const title = e.kind || "CODEOWNERS error";

    core.error(e.message?.trim() || title, {
      file,
      startLine: e.line,
      startColumn: e.column,
      title,
    });

    // Optional: also emit a notice with suggestion, if any
    if (e.suggestion) {
      core.notice(e.suggestion, {
        file,
        startLine: e.line,
        startColumn: e.column,
        title: "Suggestion",
      });
    }
  }
}

function generateMarkdownTable(errors: CodeOwnersError[]): string {
  if (!errors.length) {
    return "_No CODEOWNERS errors found._";
  }

  // Basic escaping for pipes to keep table formatting stable
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n/g, " ");

  const header =
    "| Path | Line:Col | Kind | Message | Suggestion |\n|---|---|---|---|---|";

  const rows = errors.map((e) => {
    const where = `${e.line}:${e.column}`;
    return `| ${esc(e.path || "CODEOWNERS")} | ${esc(where)} | ${esc(
      e.kind || "Error",
    )} | ${esc(e.message)} | ${esc(e.suggestion || "")} |`;
  });

  return [header, ...rows].join("\n");
}
