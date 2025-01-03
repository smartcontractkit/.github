import * as core from "@actions/core";

export function insertWithoutDuplicates<K extends string, V>(
  key: K,
  value: V,
  obj: Record<string, V>,
): Record<string, V> {
  if (key in obj) {
    core.setFailed(`Duplicate key found: ${key}`);
    return obj;
  }
  obj[key] = value;
  return obj;
}

export class BuildOrRunError extends Error {
  public readonly reason: "build" | "run";

  public readonly pkgs: string[];

  constructor(reason: "build" | "run", pkgs: string[]) {
    const message: string = `Failed to ${reason} ${pkgs.length} packages.`;
    super(message);

    this.name = "BuildOrRunError";
    this.reason = reason;
    this.pkgs = pkgs;
  }

  public logPackages(errorLog: (input: string) => void): void {
    this.pkgs.forEach((pkg) => {
      errorLog(`Failed to ${this.reason} package: ${pkg}`);
    });
  }
}
