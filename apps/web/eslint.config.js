import { nextJsConfig } from "@skerp/eslint-config/next-js";
import unusedImports from "eslint-plugin-unused-imports";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "unused-imports": unusedImports },
    rules: {
      "unused-imports/no-unused-imports": "error",
      // Several authenticated/blob-backed images cannot use next/image.
      "@next/next/no-img-element": "off",
    },
  },
];
