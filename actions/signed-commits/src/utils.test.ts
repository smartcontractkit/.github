import { execWithOutput } from "./utils";

import { describe, it, expect } from "vitest";

describe(execWithOutput.name, () => {
  it("trims the output by default", async () => {
    const cmd = "echo";
    const args = ["Hello, World! "];
    const expectedOutput = "Hello, World!";

    const output = await execWithOutput(cmd, args);

    expect(output).toBe(expectedOutput);
  });

  it("does not trim the output when notrim option is provided", async () => {
    const cmd = "echo";
    const args = ["Hello, World! "];
    const expectedOutput = "Hello, World! \n";

    const output = await execWithOutput(cmd, args, { notrim: true });
    expect(output).toBe(expectedOutput);
  });

  it("throws an error when the exit code is non-zero", async () => {
    const cmd = "exit";
    const args = ["1"];

    await expect(execWithOutput(cmd, args)).rejects.toThrowError();
  });
});
