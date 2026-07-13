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
];
