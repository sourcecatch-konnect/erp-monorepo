import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { DateTimePicker } from "./datetimepicker";

const meta: Meta<typeof DateTimePicker> = {
  title: "Components/DateTimePicker",
  component: DateTimePicker,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

export const Default: Story = {
  render: function DefaultDateTimePicker() {
    const [value, setValue] = React.useState<Date | undefined>();

    return (
      <DateTimePicker
        label="Date and time"
        selected={value}
        onSelect={setValue}
      />
    );
  },
};

export const PreSelected: Story = {
  render: function PreSelectedDateTimePicker() {
    const [value, setValue] = React.useState<Date | undefined>(
      new Date(2026, 6, 11, 14, 30),
    );

    return (
      <DateTimePicker
        label="Schedule for"
        selected={value}
        onSelect={setValue}
      />
    );
  },
};

export const FutureDatesOnly: Story = {
  render: () => (
    <DateTimePicker
      label="Appointment"
      disabled={{ before: new Date() }}
    />
  ),
};

export const Disabled: Story = {
  render: () => <DateTimePicker label="Date and time" disabled />,
};
