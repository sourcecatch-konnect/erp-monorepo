import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconInbox } from "@tabler/icons-react";

import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { HelpSection, HelpSheet } from "./help-sheet";
import { NextStep } from "./next-step";
import { Tour } from "./tour";

/** In-context help primitives used by the training feature (A7/A8). */
const meta: Meta = {
  title: "Components/Guidance",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const EmptyList: Story = {
  render: () => (
    <div className="max-w-xl rounded-md border border-border bg-card">
      <EmptyState
        icon={<IconInbox size={18} />}
        title="No orders yet"
        description="An order needs the customer, a route and a rate in the rate matrix. Use New order to book the first one."
        action={<Button>New order</Button>}
      />
    </div>
  ),
};

export const NextStepBanner: Story = {
  render: () => (
    <div className="max-w-2xl">
      <NextStep title="Order confirmed. Next: create the LRs" action={<Button size="sm">Create LR</Button>}>
        Make one LR for each consignment travelling on this order.
      </NextStep>
    </div>
  ),
};

export const HelpPanel: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Help
        </Button>
        <HelpSheet open={open} onOpenChange={setOpen} title="Orders" description="Book and follow customer orders.">
          <HelpSection title="What this screen is for">
            <p>Every customer request to move goods starts here.</p>
          </HelpSection>
          <HelpSection title="How to use it">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Press New order.</li>
              <li>Pick the customer and the branches.</li>
            </ol>
          </HelpSection>
        </HelpSheet>
      </>
    );
  },
};

export const GuidedTour: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="space-y-4">
        <Button onClick={() => setOpen(true)}>Start tour</Button>
        <div data-tour="demo-one" className="rounded-md border border-border bg-card p-4">
          First section
        </div>
        <div data-tour="demo-two" className="rounded-md border border-border bg-card p-4">
          Second section
        </div>
        <Tour
          open={open}
          onClose={() => setOpen(false)}
          steps={[
            { target: '[data-tour="demo-one"]', title: "Start here", content: "Fill this in first." },
            { target: '[data-tour="missing"]', title: "Skipped", content: "Not on the page." },
            { target: '[data-tour="demo-two"]', title: "Then this", content: "And finish here." },
          ]}
        />
      </div>
    );
  },
};
