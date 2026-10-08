import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import nx from "@nx/eslint-plugin";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

const prettierCompat = (files, config = {}) =>
  compat
    .config({ extends: ["prettier"], ...config })
    .map((flatConfig) => ({ ...flatConfig, files }));

export default [
  ...compat.extends("prettier"),
  ...nx.configs["flat/base"],
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "*",
              onlyDependOnLibsWithTags: ["*"],
            },
          ],
        },
      ],
    },
  },
  ...nx.configs["flat/typescript"],
  ...prettierCompat(["**/*.ts", "**/*.tsx"]),
  ...nx.configs["flat/javascript"],
  ...prettierCompat(["**/*.js", "**/*.jsx"]),
  ...prettierCompat(["**/*.json"], { parser: "jsonc-eslint-parser" }),
  ...prettierCompat(["**/*.yaml", "**/*.yml"]),
];
