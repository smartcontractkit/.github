import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { parseApidiffOutput } from "../apidiff.js";

// This buffer will collect what your job summary writes
let summaryBuffer: string[] = [];

// Mock @actions/core BEFORE importing string-processor
vi.mock("@actions/core", () => {
  // a minimal chainable fake summary
  const fakeSummary = {
    addHeading(text: string) {
      summaryBuffer.push(`# ${text}`);
      return fakeSummary;
    },
    addRaw(text: string) {
      summaryBuffer.push(text);
      return fakeSummary;
    },
    addSeparator() {
      summaryBuffer.push("---");
      return fakeSummary;
    },
    addTable(rows: any[][]) {
      summaryBuffer.push(
        "TABLE:\n" +
          rows
            .map((row) =>
              row
                .map((cell) =>
                  typeof cell === "object" && cell !== null
                    ? cell.data
                    : String(cell),
                )
                .join(" | "),
            )
            .join("\n"),
      );
      return fakeSummary;
    },
    clear() {
      summaryBuffer = [];
      return fakeSummary;
    },
    async write() {
      // no-op in tests; we just snapshot summaryBuffer
    },
  };

  return {
    summary: fakeSummary,
    // mock anything else from core you use (info, setFailed, etc.)
    info: vi.fn(),
    setFailed: vi.fn(),
  };
});

// IMPORTANT: import after vi.mock so it sees the mocked @actions/core
import {
  formatApidiffMarkdown,
  formatApidiffJobSummary,
} from "../string-processor.js";

const fixturesDir = path.join(__dirname, "__fixtures__");
const fixtureFiles = fs
  .readdirSync(fixturesDir)
  .filter((file) => path.extname(file) === ".txt");

describe("markdown comment & job summary", () => {
  beforeEach(() => {
    summaryBuffer = [];
  });

  for (const file of fixtureFiles) {
    const fixturePath = path.join(fixturesDir, file);
    const rawOutput = fs.readFileSync(fixturePath, "utf8");
    const moduleName = path.basename(file, path.extname(file));

    const apiDiffResult = parseApidiffOutput(moduleName, rawOutput);

    it(`formats diff as markdown comment: ${file}`, () => {
      const comment = formatApidiffMarkdown(apiDiffResult, "", true);
      expect(comment).toMatchSnapshot();
    });

    it(`formats diff as job summary: ${file}`, async () => {
      await formatApidiffJobSummary(apiDiffResult, "head-ref", "base-ref");

      // Join the collected summary parts into a single markdown string
      const content = summaryBuffer.join("\n");

      expect(content).not.toBe("");
      expect(content).toMatchSnapshot();
    });
  }
});
