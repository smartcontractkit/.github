import * as core from "@actions/core";
import {
  SummaryTableRow as TRow,
  SummaryTableCell as TCell,
} from "@actions/core/lib/summary.js";
import {
  FileValidationResult,
  LineValidationResult,
  ValidationType,
} from "./validations/validation-check.js";
import { FIXING_ERRORS, htmlLink } from "./strings";

export function logErrors(
  validationResults: FileValidationResult[],
  annotatePR: boolean = false,
) {
  for (const fileResults of validationResults) {
    for (const lineResults of fileResults.lineValidations) {
      if (lineResults.messages.length === 0) {
        continue;
      }

      const validationMessages = lineResults.messages.map(
        (error, index) =>
          `  ${index + 1}. ${error.message} (${error.type} / ${error.severity})`,
      );

      const maxSeverity = getMaxSeverityForLine(lineResults);
      const logLine = `file: ${fileResults.filename} @ line: ${lineResults.line.lineNumber} - ${validationMessages.join(",")}`;

      if (maxSeverity === "ignored") {
        core.info(`(ignored) ${logLine}`);
        continue;
      }

      const loggingMethod =
        maxSeverity === "warning" ? core.warning : core.error;
      loggingMethod(logLine);
      if (annotatePR) {
        loggingMethod(validationMessages.join("\n"), {
          file: fileResults.filename,
          startLine: lineResults.line.lineNumber,
        });
      }
    }
  }
}

export async function setSummary(
  validationResults: FileValidationResult[],
  fileUrlPrefix: string,
) {
  // Flatten the validation results into a list of rows for the summary table.
  // For each cell spanning multiple rows, you need to include it in the first row it appears in, with the rest of the cells for the first row
  // of it's rowspan. Then for each subsequent row that it spans, you only include only the other cells in that row.
  // We have filename and line numbers which span multiple rows.
  // Below is an example of the array entries in the errorRows array. Note: empty cells are not included in each array row
  // Filename LineNumber Level Type Message
  // fileA   1           error foo  bar
  //                     error foo  bar
  //         2           error foo  bar
  //                     error foo  bar
  // fileB   1           error foo  bar
  //                     error foo  bar
  //                     error foo  bar

  const headerRow: TRow = [
    { data: "Filename", header: true },
    { data: "Line Number", header: true },
    { data: "Level", header: true },
    { data: "Type", header: true },
    { data: "Message", header: true },
  ];

  const errorRows = validationResults.flatMap((fileResult) => {
    const filename = fileResult.filename;
    const lineErrorRows: TRow[] = [];

    fileResult.lineValidations.forEach((lineValidation) => {
      if (lineValidation.messages.length === 0) return;
      const ignoreErrors = lineValidation.line.ignored;

      const lineNumberCell: TCell = {
        data: htmlLink(
          `${lineValidation.line.lineNumber}`,
          `${fileUrlPrefix}/${filename}#L${lineValidation.line.lineNumber}`,
        ),
        rowspan: `${lineValidation.messages.length}`,
      };

      const validationRows: TRow[] = lineValidation.messages
        .filter(
          (message) =>
            message.type === ValidationType.IGNORE_COMMENT || !ignoreErrors,
        )
        .map((message, index) => {
          const levelCell: TCell = { data: message.severity };
          const typeCell: TCell = { data: message.type };
          const messageCell: TCell = { data: message.message };

          // First row includes the line number, subsequent rows do not
          return index === 0
            ? [lineNumberCell, levelCell, typeCell, messageCell]
            : [levelCell, typeCell, messageCell];
        });

      lineErrorRows.push(...validationRows);
    });

    if (lineErrorRows.length === 0) return [];

    const filenameCell: TCell = {
      data: filename,
      rowspan: `${lineErrorRows.length}`,
    };

    // Insert the filename in the first row and return all rows for the file
    return lineErrorRows.map((row, index) =>
      index === 0 ? [filenameCell, ...row] : row,
    );
  });

  await core.summary
    .addTable([headerRow, ...errorRows])
    .addSeparator()
    .addRaw(FIXING_ERRORS)
    .write();
}

function getMaxSeverityForLine(lvr: LineValidationResult): string {
  const maxSeverity = lvr.messages.reduce((acc, curr) => {
    if (acc === "error" || curr.severity === "error") return "error";
    if (acc === "warning" || curr.severity === "warning") return "warning";
    if (acc === "ignored" || curr.severity === "ignored") return "ignored";
    return "";
  }, "");

  if (maxSeverity === "") {
    core.warning(
      `Invalid validation severity found. Defaulting to "error" for ${lvr.filename} @ ${lvr.line.lineNumber}`,
    );
    return "error";
  }

  return maxSeverity;
}
