import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";
import { Tree, readProjectConfiguration } from "@nx/devkit";

import { createGhActionGenerator } from "./generator";
import { CreateGhActionGeneratorSchema } from "./schema";

import { describe, it, expect, beforeEach } from "vitest";

describe("create-gh-action generator", () => {
  let tree: Tree;
  const options: CreateGhActionGeneratorSchema = {
    name: "test",
    description: "this is a test",
    debug: false,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("should run successfully", async () => {
    await createGhActionGenerator(tree, options);
    const config = readProjectConfiguration(tree, "test");
    expect(config).toBeDefined();
  });
});
