// Translated from https://github.com/hmarr/codeowners/blob/main/match_test.go

import { existsSync, readFileSync } from "fs";
import * as path from "path";
import { newPattern } from "../codeowners-pattern";

import { describe, it, expect } from "vitest";

interface PatternTest {
  name: string;
  pattern: string;
  paths: Record<string, boolean>;
  focus?: boolean;
}

const jsonPath = path.join(__dirname, "data", "patterns.json");
if (!existsSync(jsonPath)) {
  throw new Error(`Test data file not found: ${jsonPath}`);
}
const raw = readFileSync(jsonPath, "utf8");
const tests: PatternTest[] = JSON.parse(raw);

// If any test has focus=true, only run those
const hasFocus = tests.some((t) => !!t.focus);
const runnable = hasFocus ? tests.filter((t) => t.focus) : tests;

describe("CODEOWNERS pattern matching", () => {
  for (const tcase of runnable) {
    describe(tcase.name, () => {
      for (const [p, shouldMatch] of Object.entries(tcase.paths)) {
        const title = shouldMatch
          ? `expects pattern "${tcase.pattern}" to MATCH "${p}"`
          : `expects pattern "${tcase.pattern}" to NOT match "${p}"`;

        it(title, () => {
          // Equivalent to: pattern, err := newPattern(test.Pattern)
          // require.NoError(t, err)
          const pattern = newPattern(tcase.pattern);

          // Debugging tips:
          // - To log the generated regex, you can rebuild it here with buildPatternRegex(tcase.Pattern)
          //   and console.log(re.source).
          // - To focus a single case, set `"Focus": true` in the JSON for that case.

          const actual = pattern.match(p); // require.NoError(t, err) equivalent (match throws only on internal errors)
          expect(actual).toBe(shouldMatch);
        });
      }
    });
  }
});
