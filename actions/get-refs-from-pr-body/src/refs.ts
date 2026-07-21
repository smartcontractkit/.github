import { REPO_CONFIG } from "./repo-config";

const FULL_SHA_RE = /^[0-9a-f]{40}$/i;

export function isFullSha(ref: string): boolean {
  return FULL_SHA_RE.test(ref);
}

export function validateGitRef(ref: string): string {
  if (!ref) {
    throw new Error("Git ref is empty");
  }

  if (ref.length > 255) {
    throw new Error(`Git ref too long (${ref.length} chars): ${ref}`);
  }

  const isCommitSHA = /^[0-9a-f]{4,40}$/i.test(ref);
  if (isCommitSHA) {
    return ref;
  }

  const isSemVer =
    /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      ref,
    );
  if (isSemVer) {
    return ref;
  }

  const isBranchOrTag =
    /^(?!.*\.lock$)(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*[ ~^:\?\*\[\\])(?!\.)(?!.*\.$)(?!.*\/\.)[A-Za-z0-9][A-Za-z0-9._\/-]*[A-Za-z0-9]$/.test(
      ref,
    );
  if (isBranchOrTag) {
    if (/^v?\d+\.\d+/.test(ref)) {
      throw new Error(
        `Invalid SemVer format for version-like tag: ${ref}. It contains leading zeros or other formatting errors.`,
      );
    }
    return ref;
  }

  throw new Error(
    `Invalid Git reference format: ${ref}. Must be a valid branch name, semver tag, or commit SHA.`,
  );
}

export type ExtractedRefs = Record<
  keyof typeof REPO_CONFIG,
  string | undefined
>;

export function extractRefsFromBody(body: string): ExtractedRefs {
  const refs: Record<string, string | undefined> = {};
  for (const [name, config] of Object.entries(REPO_CONFIG)) {
    const match = body.match(config.pattern);
    refs[name] = match?.[1];
  }
  return refs as ExtractedRefs;
}
