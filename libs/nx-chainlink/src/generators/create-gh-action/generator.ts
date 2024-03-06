import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
} from "@nx/devkit";
import * as path from "path";
import { CreateGhActionGeneratorSchema } from "./schema";

export async function createGhActionGenerator(
  tree: Tree,
  options: CreateGhActionGeneratorSchema,
) {
  const projectRoot = `actions/${options.name}`;
  // create project.json
  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: "application",
    sourceRoot: `${projectRoot}`,
    targets: {},
  });
  // generate files from templates
  generateFiles(
    tree,
    options.debug
      ? path.join(__dirname, "files", "composite", "debug")
      : path.join(__dirname, "files", "composite", "default"),
    projectRoot,
    options,
  );
  await formatFiles(tree);
}

export default createGhActionGenerator;
