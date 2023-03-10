import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest/presets/js-with-babel-esm",
};

export default jestConfig;
