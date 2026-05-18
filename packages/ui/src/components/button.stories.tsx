import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitBranchIcon, TrashIcon, SearchIcon } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ---- Basic Variants ----
export const Default: Story = { args: { children: "Default Button" } };

export const Outline: Story = { args: { children: "Outline", variant: "outline" } };

export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } };

export const Ghost: Story = { args: { children: "Ghost", variant: "ghost" } };

export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } };

export const Link: Story = { args: { children: "Link Button", variant: "link" } };

// ---- Sizes ----
export const Small: Story = { args: { children: "Small", size: "sm" } };

export const Large: Story = { args: { children: "Large", size: "lg" } };

export const ExtraSmall: Story = { args: { children: "XSmall", size: "xs" } };

// ---- With Icon ----
export const WithIcon: Story = {
  render: () => (
    <Button variant="outline" size="sm">
      <GitBranchIcon />
      New Branch
    </Button>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <Button variant="outline" size="icon">
      <SearchIcon />
    </Button>
  ),
};

export const DestructiveWithIcon: Story = {
  render: () => (
    <Button variant="destructive">
      <TrashIcon />
      Delete
    </Button>
  ),
};

// ---- All Variants at once ----
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XSmall</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};