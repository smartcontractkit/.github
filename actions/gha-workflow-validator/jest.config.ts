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
  collectCoverage: true,
} satisfies Config;
