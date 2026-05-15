import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Toaster } from "./sooner";
import { toast } from "sonner";

const meta: Meta<typeof Toaster> = {
  title: "Components/Toaster",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Toaster>;

/* ---------------- Base Setup ---------------- */
export const Default: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Toaster />

        <button
          className="px-3 py-2 rounded-md bg-black text-white"
          onClick={() => toast("Default toast")}
        >
          Show Toast
        </button>
      </div>
    );
  },
};

/* ---------------- Success ---------------- */
export const Success: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Toaster />

        <button
          className="px-3 py-2 rounded-md bg-green-600 text-white"
          onClick={() => toast.success("Success message")}
        >
          Success Toast
        </button>
      </div>
    );
  },
};

/* ---------------- Error ---------------- */
export const Error: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Toaster />

        <button
          className="px-3 py-2 rounded-md bg-red-600 text-white"
          onClick={() => toast.error("Error occurred")}
        >
          Error Toast
        </button>
      </div>
    );
  },
};

/* ---------------- Loading ---------------- */
export const Loading: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 items-start">
        <Toaster />

        <button
          className="px-3 py-2 rounded-md bg-gray-800 text-white"
          onClick={() => toast.loading("Loading...")}
        >
          Loading Toast
        </button>
      </div>
    );
  },
};