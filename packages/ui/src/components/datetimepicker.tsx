"use client";

import * as React from "react";

import { DatePicker } from "./datepicker";

export type DateTimePickerProps = Omit<
  React.ComponentProps<typeof DatePicker>,
  "withTime"
>;

/** A date and time input backed by the shared DatePicker calendar. */
export function DateTimePicker(props: DateTimePickerProps) {
  return (
    <DatePicker
      placeholder="Pick a date and time"
      {...props}
      withTime
    />
  );
}
