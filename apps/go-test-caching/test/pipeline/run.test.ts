import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

import * as path from "path";
import { readFileSync } from "fs";

import {
  filterOutputLogs,
} from "../../src/pipeline/run.js";

vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  isDebug: vi.fn(() => false),
}));

describe("filterOutputLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter out logs", () => {
    // get mock data from reading file data/error.run.log
    const dataPath = path.join(__dirname, "data/error-2.run.log");
    const logData = readFileSync(dataPath, "utf-8");

    const output = filterOutputLogs(logData);
    console.log(output);
  });


});
