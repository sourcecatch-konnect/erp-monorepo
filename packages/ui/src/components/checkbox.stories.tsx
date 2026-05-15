import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

/* ---------------- Default ---------------- */
export const Default: Story = {
  render: () => <Checkbox />,
};

/* ---------------- Checked ---------------- */
export const Checked: Story = {
  render: () => <Checkbox defaultChecked />,
};

/* ---------------- Disabled ---------------- */
export const Disabled: Story = {
  render: () => <Checkbox disabled />,
};

/* ---------------- Disabled Checked ---------------- */
export const DisabledChecked: Story = {
  render: () => <Checkbox disabled defaultChecked />,
};

/* ---------------- All States (Best View) ---------------- */
export const Showcase = {
  render: () => {
    return (
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2">
          <Checkbox />
          <span>Unchecked</span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          <span>Checked</span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox disabled />
          <span>Disabled</span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox disabled defaultChecked />
          <span>Disabled Checked</span>
        </label>
      </div>
    );
  },
};