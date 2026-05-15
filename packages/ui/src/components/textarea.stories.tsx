import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./textarea";
import React from "react";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: "Type something...",
    className: "w-80",
  },
};

export const WithValue: Story = {
  args: {
    className: "w-80",
    defaultValue: "This is some pre-filled content inside the textarea.",
  },
};

export const Disabled: Story = {
  args: {
    className: "w-80",
    placeholder: "Disabled textarea...",
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    className: "w-80",
    placeholder: "Invalid textarea...",
    "aria-invalid": true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-1.5">
      <label className="text-sm font-medium">Message</label>
      <Textarea placeholder="Type your message here..." />
    </div>
  ),
};

export const WithLabelAndError: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-1.5">
      <label className="text-sm font-medium">Message</label>
      <Textarea
        placeholder="Type your message here..."
        aria-invalid={true}
        defaultValue="Invalid input"
      />
      <p className="text-xs text-destructive">This field is required.</p>
    </div>
  ),
};

export const WithCharacterCount: Story = {
  render: () => {
    const [value, setValue] = React.useState("");
    const max = 200;
    return (
      <div className="flex w-80 flex-col gap-1.5">
        <label className="text-sm font-medium">Bio</label>
        <Textarea
          placeholder="Tell us about yourself..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={max}
        />
        <p className="text-xs text-muted-foreground text-right">
          {value.length} / {max}
        </p>
      </div>
    );
  },
};