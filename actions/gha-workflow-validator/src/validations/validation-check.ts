import { FileLine, ParsedFile } from "../utils.js";

export interface FileValidationResult {
  filename: string;
  lineValidations: LineValidationResult[];
}

export interface LineValidationResult {
  filename: string;
  line: FileLine;
  messages: ValidationMessage[];
}

export interface ValidationMessage {
  type: ValidationType;
  severity: "error" | "warning" | "ignored";
  message: string;
}

export enum ValidationType {
  SHA_REF = "sha-ref",
  VERSION_COMMENT = "version-comment",
  NODE_VERSION = "node-version",
  RUNNER = "runner",
  IGNORE_COMMENT = "ignore-comment",
}

export interface ValidationCheck {
  validate(file: ParsedFile): Promise<FileValidationResult>;
}
