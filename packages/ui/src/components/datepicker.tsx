"use client";

import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { CalendarSearch, X } from "lucide-react";
import { type DayPicker } from "react-day-picker";

import { Field, FieldLabel } from "@skerp/ui/components/Field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@skerp/ui/components/popver";
import { Button } from "@skerp/ui/components/button";
import { Calendar } from "@skerp/ui/components/calender";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

interface DatePickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: boolean | React.ComponentProps<typeof DayPicker>["disabled"];
  label?: string;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  clearable?: boolean;
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
  placeholder = "Pick a date",
  fromYear = 1950,
  toYear = new Date().getFullYear() + 20,
  clearable = true,
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
            type="button"
            variant="outline"
            id="date-picker"
            disabled={disabled === true}
            className="h-10 w-full justify-between rounded-lg px-3 font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarSearch size={17} className="shrink-0 text-muted-foreground" />
              <span
                className={
                  date
                    ? "truncate text-sm text-foreground"
                    : "truncate text-sm text-muted-foreground"
                }
              >
                {date ? format(date, "dd MMM yyyy") : placeholder}
              </span>
            </span>

            {date && clearable ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setDate(undefined);
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto rounded-xl border bg-popover p-3 shadow-xl"
          align="start"
        >
          <div className="mb-3 grid grid-cols-[1.4fr_1fr] gap-2">
            <Select
              value={String(calendarMonth.getMonth())}
              onValueChange={(value) => {
                setCalendarMonth((current) =>
                  setMonth(current, Number(value))
                );
              }}
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {months.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(calendarMonth.getFullYear())}
              onValueChange={(value) => {
                setCalendarMonth((current) =>
                  setYear(current, Number(value))
                );
              }}
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-background p-1">
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
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}