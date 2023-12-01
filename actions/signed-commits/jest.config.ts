import {Config} from 'jest'
export default {
  displayName: "signed-commits",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": "@swc/jest",
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/actions/signed-commits",
  
} satisfies Config;
