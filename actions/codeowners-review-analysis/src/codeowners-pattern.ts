// Translated from https://github.com/hmarr/codeowners/blob/main/match.go

/**
 * A CODEOWNERS/gitignore-style pattern compiled to a matcher.
 */
export class CodeownersPattern {
  private pattern: string;
  private regex?: RegExp;
  private leftAnchoredLiteral: boolean;

  constructor(patternStr: string) {
    if (patternStr == null) {
      throw new Error("empty pattern");
    }

    this.pattern = patternStr;

    // Left-anchored literal when:
    // - it starts with '/'
    // - it contains NONE of "*", "?", "\"
    if (!containsAny(patternStr, ["*", "?", "\\"]) && patternStr[0] === "/") {
      this.leftAnchoredLiteral = true;
    } else {
      this.leftAnchoredLiteral = false;
      this.regex = buildPatternRegex(patternStr);
    }
  }

  /**
   * Tests if the given path matches this pattern.
   * Normalizes Windows '\' to '/' before matching.
   */
  match(testPath: string): boolean {
    // Normalize Windows-style separators to forward slashes
    testPath = toSlash(testPath);

    if (this.leftAnchoredLiteral) {
      let prefix = this.pattern;

      // Strip the leading slash as we're anchored to the root already
      if (prefix[0] === "/") {
        prefix = prefix.slice(1);
      }

      // If the pattern ends with a slash we can do a simple prefix match
      if (prefix[prefix.length - 1] === "/") {
        return testPath.startsWith(prefix);
      }

      // If the strings are the same length, check for an exact match
      if (testPath.length === prefix.length) {
        return testPath === prefix;
      }

      // Otherwise check if the test path is a subdirectory of the pattern
      if (testPath.length > prefix.length && testPath[prefix.length] === "/") {
        return testPath.slice(0, prefix.length) === prefix;
      }

      // Otherwise the test path must be shorter than the pattern, so it can't match
      return false;
    }

    // Regex path
    if (!this.regex) {
      // Should never happen; constructor guarantees this
      throw new Error("internal: missing regex for non-literal pattern");
    }
    return this.regex.test(testPath);
  }
}

/**
 * Build a RegExp from a CODEOWNERS/gitignore-style pattern string.
 * Throws on invalid patterns, matching the Go code's error cases.
 */
export function buildPatternRegex(pattern: string): RegExp {
  // Handle specific edge cases first
  if (pattern.includes("***")) {
    throw new Error("pattern cannot contain three consecutive asterisks");
  }
  if (pattern === "") {
    throw new Error("empty pattern");
  }
  if (pattern === "/") {
    // "/" doesn't match anything: ^$ in JS (equivalent to \A\z in Go)
    return new RegExp("^$");
  }

  let segs = pattern.split("/");

  if (segs[0] === "") {
    // Leading slash: match is relative to root
    segs = segs.slice(1);
  } else {
    // No leading slash - single segment patterns match relative to any descendent path
    // (equivalent to a leading **/)
    if (segs.length === 1 || (segs.length === 2 && segs[1] === "")) {
      if (segs[0] !== "**") {
        segs = ["**", ...segs];
      }
    }
  }

  if (segs.length > 1 && segs[segs.length - 1] === "") {
    // Trailing slash is equivalent to "/**"
    segs[segs.length - 1] = "**";
  }

  const sep = "/";

  const lastSegIndex = segs.length - 1;
  let needSlash = false;
  let re = "^"; // Go used \A ... \z; in JS use ^ ... $

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];

    switch (seg) {
      case "**":
        if (i === 0 && i === lastSegIndex) {
          // If the pattern is just "**" we match everything
          re += ".+";
        } else if (i === 0) {
          // Starts with "**": match any leading path segment (possibly empty) followed by "/"
          // Using (?:.+/)? so it only consumes if something is there; mirrors Go
          re += `(?:.+${escapeForRegex(sep)})?`;
          needSlash = false;
        } else if (i === lastSegIndex) {
          // Ends with "**": match any trailing path segment (including empty)
          re += `${escapeForRegex(sep)}.*`;
        } else {
          // Contains "**": match zero or more path segments between slashes
          re += `(?:${escapeForRegex(sep)}.+)?`;
          needSlash = true;
        }
        break;

      case "*":
        if (needSlash) {
          re += escapeForRegex(sep);
        }
        // Regular wildcard - match any characters except the separator
        re += `[^${escapeForRegex(sep)}]+`;
        needSlash = true;
        break;

      default:
        if (needSlash) {
          re += escapeForRegex(sep);
        }

        // Process escapes and wildcards within the segment
        let escapeNext = false;
        for (let idx = 0; idx < seg.length; idx++) {
          const ch = seg[idx];

          if (escapeNext) {
            escapeNext = false;
            re += escapeForRegex(ch);
            continue;
          }

          // Other pathspec implementations handle character classes here (e.g. [AaBb]),
          // but CODEOWNERS doesn't support that so we don't need to.
          if (ch === "\\") {
            escapeNext = true;
          } else if (ch === "*") {
            // Multi-character wildcard (but not crossing '/')
            re += `[^${escapeForRegex(sep)}]*`;
          } else if (ch === "?") {
            // Single-character wildcard (not '/')
            re += `[^${escapeForRegex(sep)}]`;
          } else {
            // Regular character
            re += escapeForRegex(ch);
          }
        }

        if (i === lastSegIndex) {
          // As there's no trailing slash (that'd hit the '**' case), we need to match descendent paths
          re += `(?:${escapeForRegex(sep)}.*)?`;
        }

        needSlash = true;
        break;
    }
  }

  re += "$";
  return new RegExp(re);
}

/**
 * Factory to mirror the Go `newPattern` function name/signature semantics.
 * (Throws instead of returning an error.)
 */
export function newPattern(patternStr: string): CodeownersPattern {
  return new CodeownersPattern(patternStr);
}

/* ------------------------- helpers ------------------------- */

function toSlash(p: string): string {
  // Replace backslashes with forward slashes
  return p.replace(/\\/g, "/");
}

function containsAny(s: string, chars: string[]): boolean {
  for (const c of chars) {
    if (s.includes(c)) return true;
  }
  return false;
}

/** Escape a literal for inclusion inside a JS RegExp source. */
function escapeForRegex(lit: string): string {
  // Same effect as Go's regexp.QuoteMeta for single characters/strings
  return lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
