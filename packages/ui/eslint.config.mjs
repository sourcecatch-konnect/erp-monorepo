// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { config } from "@skerp/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  ...storybook.configs["flat/recommended"],
  {
    files: ["**/*.stories.{ts,tsx}"],
    rules: {
      // CSF render callbacks are React components despite being object methods.
      "react-hooks/rules-of-hooks": "off",
    },
  },
];
