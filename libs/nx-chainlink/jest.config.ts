/* eslint-disable */
export default {
  displayName: "nx-chainlink",
  preset: "../../jest.preset.js",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/libs/nx-chainlink",
  collectCoverage: true,
  clearCache: true,
  coverageReporters: ["lcov"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "coverage/junit",
        outputName: "junit.xml",
      },
    ],
  ],
};
