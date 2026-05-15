import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { addDays, subDays } from "date-fns";
import { type DateRange } from "react-day-picker";

import { DatePickerWithRange } from "./DateRangePicker";

const meta: Meta<typeof DatePickerWithRange> = {
  title: "Components/DatePickerRange",
  component: DatePickerWithRange,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DatePickerWithRange>;

// ---- Default (pre-filled range) ----
export const Default: Story = {
  render: () => <DatePickerWithRange />,
};

// ---- Empty (no default) ----
export const Empty: Story = {
  render: () => {
    const [date, setDate] = React.useState<DateRange | undefined>(undefined);
    return <DatePickerWithRange selected={date} onSelect={setDate} />;
  },
};

// ---- This Week ----
export const ThisWeek: Story = {
  render: () => {
    const today = new Date();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: today,
      to: addDays(today, 6),
    });
    return <DatePickerWithRange selected={date} onSelect={setDate} />;
  },
};

// ---- Last 30 Days ----
export const LastThirtyDays: Story = {
  render: () => {
    const today = new Date();
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: subDays(today, 30),
      to: today,
    });
    return <DatePickerWithRange selected={date} onSelect={setDate} />;
  },
};

// ---- Only From Selected ----
export const OnlyFromSelected: Story = {
  render: () => {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: new Date(),
      to: undefined,
    });
    return <DatePickerWithRange selected={date} onSelect={setDate} />;
  },
};

// ---- With Min Date ----
export const WithMinDate: Story = {
  render: () => (
    <DatePickerWithRange
      disabled={{ before: new Date() }}
      label="Future Range Only"
    />
  ),
};