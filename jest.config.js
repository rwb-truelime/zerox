/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules"],
  modulePathIgnorePatterns: ["<rootDir>/extracted_backups"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "node-zerox/tsconfig.json",
      },
    ],
  },
};
