import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { addDays, subDays } from "date-fns";

import { DatePicker } from "./datepicker";
const meta: Meta<typeof DatePicker> = {
  title: "Components/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

// ---- Default (empty) ----
export const Default: Story = {
  render: () => <DatePicker />,
};

// ---- Pre-selected Date ----
export const PreSelected: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    return <DatePicker selected={date} onSelect={setDate} />;
  },
};

// ---- Disabled ----
export const Disabled: Story = {
  render: () => <DatePicker disabled />,
};

// ---- With Min Date ----
export const WithMinDate: Story = {
  render: () => (
    <DatePicker
      disabled={{ before: new Date() }}
      label="Future Dates Only"
    />
  ),
};

// ---- With Max Date ----
export const WithMaxDate: Story = {
  render: () => (
    <DatePicker
      disabled={{ after: new Date() }}
      label="Past Dates Only"
    />
  ),
};