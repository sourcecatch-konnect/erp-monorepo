import { nextJsConfig } from "@skerp/eslint-config/next-js";
import unusedImports from "eslint-plugin-unused-imports";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    /*
     * Build-time scripts are Node, not browser: they are run by hand with
     * `node`, never bundled. Without this they are linted with browser
     * globals only and every `process` reads as an undefined variable.
     */
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
      sourceType: "module",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "unused-imports": unusedImports },
    rules: {
      "unused-imports/no-unused-imports": "error",
      // Several authenticated/blob-backed images cannot use next/image.
      "@next/next/no-img-element": "off",
    },
  },
  {
    // remove-before-prod: in-app feedback may only be imported by its two
    // mount points, so deleting the feature can never break another module.
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "features/feedback/**",
      "components/layout/AppShell.tsx",
      "app/(dashboard)/settings/feedback/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/feedback", "@/features/feedback/*"],
              message:
                "Feedback is temporary (remove-before-prod). Only AppShell and the settings/feedback route may import it.",
            },
          ],
        },
      ],
    },
  },
];
