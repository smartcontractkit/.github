import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import nx from "@nx/eslint-plugin";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

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
  ...compat
    .config({
      extends: ["prettier"],
    })
    .map((config) => ({
      ...config,
      files: ["**/*.ts", "**/*.tsx"],
      rules: {
        ...config.rules,
      },
    })),
  ...nx.configs["flat/javascript"],
  ...compat
    .config({
      extends: ["prettier"],
    })
    .map((config) => ({
      ...config,
      files: ["**/*.js", "**/*.jsx"],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      parser: "jsonc-eslint-parser",
      extends: ["prettier"],
    })
    .map((config) => ({
      ...config,
      files: ["**/*.json"],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      extends: ["prettier"],
    })
    .map((config) => ({
      ...config,
      files: ["**/*.yaml", "**/*.yml"],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      env: {},
    })
    .map((config) => ({
      ...config,
      files: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.spec.js", "**/*.spec.jsx"],
      rules: {
        ...config.rules,
      },
    })),
];
