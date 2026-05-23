"use client";

import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { CalendarSearch } from "lucide-react";
import { type DayPicker } from "react-day-picker";

import { Field, FieldLabel } from "@skerp/ui/components/Field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { Button } from "@skerp/ui/components/button";
import { Calendar } from "@skerp/ui/components/calender";

interface DatePickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: boolean | React.ComponentProps<typeof DayPicker>["disabled"];
  label?: string;
  fromYear?: number;
  toYear?: number;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function DatePicker({
  selected: selectedProp,
  onSelect: onSelectProp,
  disabled,
  label = "Date",
  fromYear = 1950,
  toYear = new Date().getFullYear() + 20,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>();

  const date = selectedProp ?? internalDate;
  const setDate = onSelectProp ?? setInternalDate;

  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    date ?? new Date()
  );

  React.useEffect(() => {
    if (date) {
      setCalendarMonth(date);
    }
  }, [date]);

  const years = React.useMemo(() => {
    const list: number[] = [];

    for (let year = toYear; year >= fromYear; year -= 1) {
      list.push(year);
    }

    return list;
  }, [fromYear, toYear]);

  return (
    <Field className="w-full">
      <FieldLabel htmlFor="date-picker">{label}</FieldLabel>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker"
            disabled={disabled === true}
            className="w-full justify-start px-2.5 font-normal"
          >
            <CalendarSearch size={17} className="mr-2 shrink-0" />
            {date ? format(date, "LLL dd, y") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-3" align="start">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select
              value={calendarMonth.getMonth()}
              onChange={(event) => {
                setCalendarMonth((current) =>
                  setMonth(current, Number(event.target.value))
                );
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none"
            >
              {months.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>

            <select
              value={calendarMonth.getFullYear()}
              onChange={(event) => {
                setCalendarMonth((current) =>
                  setYear(current, Number(event.target.value))
                );
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={date}
            onSelect={(selectedDate) => {
              setDate(selectedDate);
              setOpen(false);
            }}
            disabled={disabled !== true ? disabled : undefined}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}