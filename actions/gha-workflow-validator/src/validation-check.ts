import { FileLine, ParsedFile } from "./utils.js";

export interface FileValidationResult {
  filename: string;
  lineValidations: LineValidationResult[];
}

export interface LineValidationResult {
  filename: string;
  line: FileLine;
  validationErrors: ValidationError[];
}

export interface ValidationError {
  type: ErrorType;
  severity: "error" | "warning";
  message: string;
}

export enum ErrorType {
  SHA_REF = "sha-ref",
  VERSION_COMMENT = "version-comment",
  NODE_VERSION = "node-version",
  RUNNER = "runner",
}

export interface ValidationCheck {
  validate(file: ParsedFile): Promise<FileValidationResult>;
}
