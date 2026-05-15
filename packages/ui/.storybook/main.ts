import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],

  viteFinal: async (config) => {
    config.css = {
      postcss: "./postcss.config.js",
    };
    return config;
  },
};

export default config;