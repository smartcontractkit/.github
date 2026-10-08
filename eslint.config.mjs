import eslintConfigPrettier from "eslint-config-prettier";
import js from "@eslint/js";
import * as jsoncEslintParser from "jsonc-eslint-parser";
import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
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
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.jsx"],
    ...js.configs.recommended,
  },
  {
    files: ["**/*.json"],
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  eslintConfigPrettier,
);
