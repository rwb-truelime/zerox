/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules"],
  testMatch: ["**/node-zerox/tests/**/*.test.ts", "**/node-zerox/tests/**/*.spec.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "node-zerox/tsconfig.json",
      },
    ],
  },
};
