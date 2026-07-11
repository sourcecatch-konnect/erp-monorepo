import { nextJsConfig } from "@skerp/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Existing feature modules predate strict unused/any enforcement. Keep
      // the rest of the Next.js and React correctness rules blocking in CI.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Several authenticated/blob-backed images cannot use next/image.
      "@next/next/no-img-element": "off",
    },
  },
];
