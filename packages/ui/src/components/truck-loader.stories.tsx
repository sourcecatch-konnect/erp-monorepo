import type { Meta, StoryObj } from "@storybook/react-vite";

import { TruckLoader } from "./truck-loader";

const meta: Meta<typeof TruckLoader> = {
  title: "Components/TruckLoader",
  component: TruckLoader,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof TruckLoader>;

export const Default: Story = {};

export const WithCustomLabel: Story = {
  args: {
    label: "Fetching trips…",
  },
};

export const WithoutLabel: Story = {
  args: {
    label: null,
  },
};

export const Large: Story = {
  args: {
    className: "[&_svg]:w-48",
  },
};
