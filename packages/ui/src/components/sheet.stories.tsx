import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./sheet";

import { Button } from "./button";

const meta: Meta<typeof Sheet> = {
  title: "Components/Sheet",
  component: Sheet,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Sheet>;

/* ---------------- Default ---------------- */
export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet</Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>
            This is a Radix Dialog-based Sheet component.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 text-sm">
          Main content goes here...
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/* ---------------- Right Side ---------------- */
export const RightSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Right Sheet</Button>
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Right Sheet</SheetTitle>
          <SheetDescription>Slides in from the right</SheetDescription>
        </SheetHeader>

        <div className="p-4">Content...</div>
      </SheetContent>
    </Sheet>
  ),
};

/* ---------------- Left Side ---------------- */
export const LeftSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Left Sheet</Button>
      </SheetTrigger>

      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left Sheet</SheetTitle>
          <SheetDescription>Slides in from the left</SheetDescription>
        </SheetHeader>

        <div className="p-4">Content...</div>
      </SheetContent>
    </Sheet>
  ),
};

/* ---------------- Without Close Button ---------------- */
export const NoCloseButton: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open Sheet</Button>
      </SheetTrigger>

      <SheetContent showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>No Close Button</SheetTitle>
          <SheetDescription>
            Close using outside click or ESC
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">Content...</div>
      </SheetContent>
    </Sheet>
  ),
};