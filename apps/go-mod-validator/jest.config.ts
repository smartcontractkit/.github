import { Config } from "jest";
export default {
  displayName: "go-mod-validator",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": "@swc/jest",
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/apps/go-mod-validator",
  collectCoverage: true,
} satisfies Config;
