"use client";

import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { CalendarSearch, Check, Clock, X } from "lucide-react";
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
  withTime?: boolean;
}

function hasTimeValue(date?: Date) {
  if (!date) return false;

  return (
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0 ||
    date.getMilliseconds() !== 0
  );
}

function mergeDateWithExistingTime(
  selectedDate: Date | undefined,
  existingDate: Date | undefined,
) {
  if (!selectedDate) return undefined;

  const next = new Date(selectedDate);

  next.setHours(existingDate?.getHours() ?? 0);
  next.setMinutes(existingDate?.getMinutes() ?? 0);
  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
}

function clearTime(existingDate: Date | undefined) {
  if (!existingDate) return existingDate;

  const next = new Date(existingDate);
  next.setHours(0);
  next.setMinutes(0);
  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
}

function setTimePart(
  existingDate: Date | undefined,
  part: "hour" | "minute" | "period",
  value: string,
) {
  if (!existingDate) return existingDate;

  const next = new Date(existingDate);
  const currentHours = next.getHours();
  const currentMinutes = next.getMinutes();
  const currentPeriod = currentHours >= 12 ? "PM" : "AM";
  let hour12 = currentHours % 12 || 12;
  let minutes = currentMinutes;
  let period = currentPeriod;

  if (part === "hour") hour12 = Number(value);
  if (part === "minute") minutes = Number(value);
  if (part === "period") period = value;

  const hours =
    period === "PM" ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;

  next.setHours(hours);
  next.setMinutes(minutes);
  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
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

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export function DatePicker({
  selected: selectedProp,
  onSelect: onSelectProp,
  disabled,
  label,
  placeholder = "Pick a date",
  fromYear = 1950,
  toYear = new Date().getFullYear() + 20,
  clearable = true,
  withTime = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>();


  const date = selectedProp ?? internalDate;
  const setDate = onSelectProp ?? setInternalDate;

  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    date ?? new Date(),
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

  const displayFormat =
    withTime && date  ? "dd MMM yyyy hh:mm a" : "dd MMM yyyy";
  const currentHour = date ? String(date.getHours() % 12 || 12) : "12";
  const currentMinute = date
    ? String(date.getMinutes()).padStart(2, "0")
    : "00";
  const currentPeriod = date && date.getHours() >= 12 ? "PM" : "AM";

  return (
    <Field className="w-full">
      {label ? <FieldLabel htmlFor="date-picker">{label}</FieldLabel> : null}

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
              <CalendarSearch
                size={17}
                className="shrink-0 text-muted-foreground"
              />
              <span
                className={
                  date
                    ? "truncate text-sm text-foreground"
                    : "truncate text-sm text-muted-foreground"
                }
              >
                {date ? format(date, displayFormat) : placeholder}
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
  align="start"
  sideOffset={6}
  className="rounded-xl border bg-popover p-3 shadow-xl"
  style={{
    width: withTime ? 570 : 330,
    maxWidth: "calc(100vw - 24px)",
  }}
>
  <div
    className="grid gap-3"
    style={{
      gridTemplateColumns: withTime ? "320px 220px" : "320px",
    }}
  >
    {/* LEFT SIDE: DATE */}
    <div>
      <div className="mb-3 grid grid-cols-[1.4fr_1fr] gap-2">
        <Select
          value={String(calendarMonth.getMonth())}
          onValueChange={(value) => {
            setCalendarMonth((current) => setMonth(current, Number(value)));
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
            setCalendarMonth((current) => setYear(current, Number(value)));
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
  setDate(
    mergeDateWithExistingTime(
      selectedDate,
      date ?? (withTime ? new Date() : undefined),
    ),
  );

  if (!withTime) setOpen(false);
}}
          disabled={disabled !== true ? disabled : undefined}
        />
      </div>
    </div>

    {/* RIGHT SIDE: TIME */}
    {withTime ? (
  <div className="rounded-lg border bg-muted/20 p-3">
    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Clock size={14} />
      Time
    </div>

    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Hour
        </p>

        <Select
          value={currentHour}
          disabled={!date}
          onValueChange={(value) => {
            setDate(setTimePart(date, "hour", value));
          }}
        >
          <SelectTrigger className="h-9 rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>

          <SelectContent className="max-h-72">
            {hours.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour.padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Minute
        </p>

        <Select
          value={currentMinute}
          disabled={!date}
          onValueChange={(value) => {
            setDate(setTimePart(date, "minute", value));
          }}
        >
          <SelectTrigger className="h-9 rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>

          <SelectContent className="max-h-72">
            {minutes.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Period
        </p>

        <Select
          value={currentPeriod}
          disabled={!date}
          onValueChange={(value) => {
            setDate(setTimePart(date, "period", value));
          }}
        >
          <SelectTrigger className="h-9 rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!date}
        onClick={() => setOpen(false)}
      >
        <Check size={14} className="mr-1.5" />
        Apply
      </Button>
    </div>
  </div>
) : null}
  </div>
</PopoverContent>
      </Popover>
    </Field>
  );
}
