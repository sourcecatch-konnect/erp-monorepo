import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Popover,
      PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
 } from "./popver";
import { Button } from "./button";

const meta: Meta<typeof Popover> = {
  title: "Components/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Open Popover</Button>
      </PopoverTrigger>

      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Popover Title</PopoverTitle>
          <PopoverDescription>
            This is a short description inside the popover.
          </PopoverDescription>
        </PopoverHeader>

        <div className="text-sm">
          This is the main popover content area.
        </div>
      </PopoverContent>
    </Popover>
  ),
};