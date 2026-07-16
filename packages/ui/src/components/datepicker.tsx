"use client";

import * as React from "react";
import { format } from "date-fns";
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

export interface DatePickerProps {
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

function setTime(
  existingDate: Date | undefined,
  hourValue: string,
  minuteValue: string,
  period: "AM" | "PM",
) {
  const hour = Number(hourValue);
  const minutes = Number(minuteValue);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minutes) ||
    hour < 1 ||
    hour > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return existingDate;
  }

  const next = new Date(existingDate ?? new Date());
  const hours = period === "PM" ? (hour % 12) + 12 : hour % 12;
  next.setHours(hours, minutes, 0, 0);

  return next;
}

function TimePicker({
  date,
  onChange,
}: {
  date: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  const [hour, setHour] = React.useState("12");
  const [minute, setMinute] = React.useState("00");
  const [period, setPeriod] = React.useState<"AM" | "PM">("AM");

  React.useEffect(() => {
    if (!date) return;
    setHour(String(date.getHours() % 12 || 12).padStart(2, "0"));
    setMinute(String(date.getMinutes()).padStart(2, "0"));
    setPeriod(date.getHours() >= 12 ? "PM" : "AM");
  }, [date]);

  const commit = (
    nextHour = hour,
    nextMinute = minute,
    nextPeriod = period,
  ) => onChange(setTime(date, nextHour, nextMinute, nextPeriod));

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <input
          aria-label="Hour"
          inputMode="numeric"
          maxLength={2}
          value={hour}
          onChange={(event) => setHour(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <span className="font-medium text-muted-foreground">:</span>
      <div className="relative min-w-0 flex-1">
        <input
          aria-label="Minute"
          inputMode="numeric"
          maxLength={2}
          value={minute}
          onChange={(event) => setMinute(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <Select
        value={period}
        onValueChange={(value) => {
          const nextPeriod = value as "AM" | "PM";
          setPeriod(nextPeriod);
          commit(hour, minute, nextPeriod);
        }}
      >
        <SelectTrigger aria-label="AM or PM" className="h-8 w-[74px] rounded-md px-2 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

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
  const inputId = React.useId();


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

  const displayFormat = withTime ? "dd MMM yyyy, hh:mm a" : "dd MMM yyyy";
  return (
    <Field className="w-full">
      {label ? <FieldLabel htmlFor={inputId}>{label}</FieldLabel> : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            id={inputId}
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
          className="w-[min(264px,calc(100vw-12px))] rounded-lg border bg-popover p-1.5 shadow-lg"
        >
          {withTime ? (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-muted/40 p-1.5">
              <Clock size={14} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <TimePicker date={date} onChange={setDate} />
              </div>
            </div>
          ) : null}

          <div>
      <div className="overflow-hidden rounded-md border bg-background p-1">
        <Calendar
          className="w-full p-0 [--cell-size:1.4rem]"
          classNames={{
            root: "w-full",
            months: "relative flex w-full flex-col",
            month: "flex w-full flex-col gap-1",
            month_grid: "w-full border-collapse",
            week: "mt-0.5 flex w-full",
            dropdowns: "flex h-7 items-center justify-center gap-1 text-xs font-medium",
            dropdown_root:
              "relative rounded-md border border-input bg-muted/40 px-1.5 py-0.5 transition-colors hover:bg-muted",
            dropdown: "absolute inset-0 cursor-pointer opacity-0",
            caption_label:
              "flex items-center gap-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:text-muted-foreground",
          }}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
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
            {withTime ? (
              <div className="mt-1.5 flex justify-end border-t pt-1.5">
      <Button
        type="button"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={!date}
        onClick={() => setOpen(false)}
      >
        <Check size={14} className="mr-1.5" />
        Apply
      </Button>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
