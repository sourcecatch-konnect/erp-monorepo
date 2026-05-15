import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Switch>;

/* ---------------- Default ---------------- */
export const Default: Story = {
  render: () => <Switch />,
};

/* ---------------- Checked ---------------- */
export const Checked: Story = {
  render: () => <Switch defaultChecked />,
};

/* ---------------- Disabled ---------------- */
export const Disabled: Story = {
  render: () => <Switch disabled />,
};

/* ---------------- Small Size ---------------- */
export const Small: Story = {
  render: () => <Switch size="sm" />,
};

/* ---------------- Checked Small ---------------- */
export const SmallChecked: Story = {
  render: () => <Switch size="sm" defaultChecked />,
};

/* ---------------- Showcase ---------------- */
export const Showcase: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 items-start">
        <label className="flex items-center gap-2">
          <Switch />
          <span>Off</span>
        </label>

        <label className="flex items-center gap-2">
          <Switch defaultChecked />
          <span>On</span>
        </label>

        <label className="flex items-center gap-2">
          <Switch disabled />
          <span>Disabled</span>
        </label>

        <label className="flex items-center gap-2">
          <Switch size="sm" />
          <span>Small</span>
        </label>
      </div>
    );
  },
};