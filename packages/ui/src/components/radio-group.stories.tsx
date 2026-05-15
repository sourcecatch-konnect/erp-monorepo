import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { RadioGroup, RadioGroupItem } from "./radioButton";

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

/* ---------------- Default ---------------- */
export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="option1" className="w-[220px]">
      <label className="flex items-center gap-2">
        <RadioGroupItem value="option1" />
        <span>Option 1</span>
      </label>

      <label className="flex items-center gap-2">
        <RadioGroupItem value="option2" />
        <span>Option 2</span>
      </label>

      <label className="flex items-center gap-2">
        <RadioGroupItem value="option3" />
        <span>Option 3</span>
      </label>
    </RadioGroup>
  ),
};

/* ---------------- With Disabled Option ---------------- */
export const WithDisabled: Story = {
  render: () => (
    <RadioGroup defaultValue="option1" className="w-[220px]">
      <label className="flex items-center gap-2">
        <RadioGroupItem value="option1" />
        <span>Enabled</span>
      </label>

      <label className="flex items-center gap-2 opacity-50">
        <RadioGroupItem value="option2" disabled />
        <span>Disabled</span>
      </label>

      <label className="flex items-center gap-2">
        <RadioGroupItem value="option3" />
        <span>Another Option</span>
      </label>
    </RadioGroup>
  ),
};

/* ---------------- Horizontal Layout ---------------- */
export const Horizontal: Story = {
  render: () => (
    <RadioGroup
      defaultValue="a"
      className="flex gap-6 w-[300px]"
    >
      <label className="flex items-center gap-2">
        <RadioGroupItem value="a" />
        <span>A</span>
      </label>

      <label className="flex items-center gap-2">
        <RadioGroupItem value="b" />
        <span>B</span>
      </label>

      <label className="flex items-center gap-2">
        <RadioGroupItem value="c" />
        <span>C</span>
      </label>
    </RadioGroup>
  ),
};