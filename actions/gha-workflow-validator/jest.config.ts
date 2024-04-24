import {Config} from 'jest'
export default {
  displayName: "gha-workflow-validator",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": "@swc/jest",
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/actions/gha-workflow-validator",
  testPathIgnorePatterns: ["src/__tests__/__fixtures__",  "src/__tests__/__snapshots__/", "src/__tests__/__helpers__"],
  collectCoverage: true,
} satisfies Config;
