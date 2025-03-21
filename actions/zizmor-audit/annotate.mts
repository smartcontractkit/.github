#!/usr/bin/env node

import * as core from "@actions/core";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { cwd } from "process";
import { start } from "repl";

function processCLIInputs() {
  const [path, minSeverity] = process.argv.slice(2);

  if (!path || !minSeverity) {
    core.error("Usage: node annotate.mts <path> <minSeverity>");
    process.exit(1);
  }

  if (!["low", "medium", "high", "informational", "unknown"].includes(minSeverity)) {
    core.error("minSeverity must be one of low, medium, high, informational, unknown");
    process.exit(1);
  }

  if (!existsSync(path)) {
    core.error(`Path (${path}) does not exist.`);
    process.exit(1);
  }

  return [path, minSeverity];
}

function main() {
  core.info("Running Zizmor audit...");

  const [path, minSeverity] = processCLIInputs();

  const zizStdOut = execSync(`zizmor ${path} --min-severity=${minSeverity} --quiet --format=json --no-exit-codes`, { encoding: "utf-8" }).trim();

  const zizEntries = JSON.parse(zizStdOut) as ZizmorEntry[];

  for (const zEntry of zizEntries) {
    if (zEntry.ignored) {
      core.info(`Ignored: ${zEntry.ident}`);
      continue;
    }

    const location = zEntry.locations[zEntry.locations.length - 1];

    const workflowPath = join(cwd(), location.symbolic.key.Local.given_path);
    const annotationProperties = {
      title: zEntry.ident,
      file: workflowPath,
      startLine: location.concrete.location.start_point.row,
      endLine: location.concrete.location.end_point.row,
    }
    core.error(`Zizmor violation: ${zEntry.desc} - ${zEntry.url}\n${location.symbolic.annotation}`, { ...annotationProperties });
  }
}

main();


interface ZizmorEntry {
  ident: string;
  desc: string;
  url: string;
  determinations: {
    confidence: string;
    severity: string;
    persona: string;
  },
  locations: ZizmorLocation[];
  ignored: boolean;
}

interface ZizmorLocation {
  symbolic: ZizmorLocationSymbolic;
  concrete: ZizmorLocationConcrete;

}


interface ZizmorLocationSymbolic {
  key: {
    Local: {
      prefix: string;
      given_path: string;
    }
  };
  annotation: string;
  route: {
    components: { Key: string }[];
  }
  primary: boolean;
}

interface ZizmorLocationConcrete {
  location: {
    start_point: {
      row: number;
      column: number;
    },
    end_point: {
      row: number;
      column: number;
    },
    offset_span: {
      start: number;
      end: number;
    }
  };
  feature: string;
  comments: string[];
}
