import { getAllWorkflowAndActionFiles } from "../utils.js";

import { join } from "path";
import { vi, describe, it, expect } from "vitest";

vi.mock("@actions/core", async () => {
  return (await import("./__helpers__/test-utils.js")).coreLoggingStubs();
});

describe(getAllWorkflowAndActionFiles.name, () => {
  it("should return all relevant files in .github directory", async () => {
    const directory = join(__dirname, "/fake-repo");
    const files = await getAllWorkflowAndActionFiles(directory, false);
    expect(files).toMatchSnapshot();
  });

  it("should return all relevant files in repo", async () => {
    const directory = join(__dirname, "/fake-repo");
    const files = await getAllWorkflowAndActionFiles(directory, true);
    expect(files).toMatchSnapshot();
  });
});
