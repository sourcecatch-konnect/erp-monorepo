import { config } from "@skerp/eslint-config/base";

export default [
  ...config,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Express request augmentation is currently declared as a namespace.
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // remove-before-prod: only index.ts may mount the feedback module.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/modules/feedback/**", "src/index.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/feedback/*", "./feedback/*", "../feedback/*"],
              message:
                "Feedback is temporary (remove-before-prod). Only src/index.ts may import it.",
            },
          ],
        },
      ],
    },
  },
];
