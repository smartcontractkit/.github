import baseConfig from "../../eslint.config.mjs";
import * as jsoncEslintParser from "jsonc-eslint-parser";

export default [
  ...baseConfig,
  {
    files: ["./package.json"],
    rules: {
      "@nx/nx-plugin-checks": "error",
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    ignores: ["src/generated/*.ts"],
  },
];
