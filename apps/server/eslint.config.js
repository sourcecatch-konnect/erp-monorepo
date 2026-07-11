import { config } from "@skerp/eslint-config/base";

export default [
  ...config,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Legacy CRUD adapters use dynamic Prisma delegate shapes. Tightening these
      // types is a separate refactor; all other recommended rules remain active.
      "@typescript-eslint/no-explicit-any": "off",
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
