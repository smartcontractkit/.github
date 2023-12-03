import unified from "unified";
import type { Node, Parent } from "unist";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
// @ts-ignore
import mdastToString from "mdast-util-to-string";
import { getPackages, Package } from "@manypkg/get-packages";
import { exec, getExecOutput } from "@actions/exec";

export const BumpLevels = {
  dep: 0,
  patch: 1,
  minor: 2,
  major: 3,
} as const;

export async function getVersionsByDirectory(cwd: string) {
  let { packages } = await getPackages(cwd);
  return new Map(packages.map((x) => [x.dir, x.packageJson.version]));
}

export async function getChangedPackages(
  cwd: string,
  previousVersions: Map<string, string>,
) {
  let { packages } = await getPackages(cwd);
  let changedPackages = new Set<Package>();

  for (let pkg of packages) {
    const previousVersion = previousVersions.get(pkg.dir);
    if (previousVersion !== pkg.packageJson.version) {
      changedPackages.add(pkg);
    }
  }

  return [...changedPackages];
}

export function getChangelogEntry(changelog: string, version: string) {
  let ast = unified().use(remarkParse).parse(changelog);

  let highestLevel: number = BumpLevels.dep;
  if (!isParentNode(ast)) {
    throw new Error("ast is not a parent node");
  }

  let nodes = ast.children;
  let headingStartInfo:
    | {
        index: number;
        depth: number;
      }
    | undefined;
  let endIndex: number | undefined;

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];

    if (node.type === "heading") {
      if (!nodeHasDepthProperty(node)) {
        throw new Error("node is missing depth property");
      }
      let stringified: string = mdastToString(node);
      let match = stringified.toLowerCase().match(/(major|minor|patch)/);
      if (match !== null) {
        let level = BumpLevels[match[0] as "major" | "minor" | "patch"];
        highestLevel = Math.max(level, highestLevel);
      }
      if (headingStartInfo === undefined && stringified === version) {
        headingStartInfo = {
          index: i,
          depth: node.depth,
        };
        continue;
      }
      if (
        endIndex === undefined &&
        headingStartInfo !== undefined &&
        headingStartInfo.depth === node.depth
      ) {
        endIndex = i;
        break;
      }
    }
  }
  if (headingStartInfo) {
    ast.children = (ast.children as any).slice(
      headingStartInfo.index + 1,
      endIndex,
    );
  }
  return {
    content: unified().use(remarkStringify).stringify(ast),
    highestLevel: highestLevel,
  };
}

export function sortTheThings(
  a: { private: boolean; highestLevel: number },
  b: { private: boolean; highestLevel: number },
) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel;
  }
  if (a.private) {
    return 1;
  }
  return -1;
}

export async function execWithOutput(
  cmd: Parameters<typeof exec>[0],
  args: Parameters<typeof exec>[1],
  opts?: { notrim?: boolean; cwd?: string },
) {
  let { exitCode, stdout, stderr } = await getExecOutput(cmd, args, opts);

  if (!opts?.notrim) {
    stdout = stdout.trim();
    stderr = stderr.trim();
  }

  if (exitCode !== 0) {
    throw Error(stderr);
  }

  return stdout;
}

function isParentNode(node: Node<any>): node is Parent {
  return "children" in node;
}

function nodeHasDepthProperty(
  node: Node<any>,
): node is Node & { depth: number } {
  return "depth" in node;
}
