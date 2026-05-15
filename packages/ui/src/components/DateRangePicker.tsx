"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange, type DayPicker } from "react-day-picker"

import { Button } from "./button"
import { Calendar } from "./calender"
import { Field, FieldLabel } from "./Field"
import { Popover, PopoverContent, PopoverTrigger } from "./popver"

interface DatePickerWithRangeProps {
  selected?: DateRange
  onSelect?: (date: DateRange | undefined) => void
  disabled?: boolean | React.ComponentProps<typeof DayPicker>["disabled"]
  label?: string
}

export function DatePickerWithRange({
  selected: selectedProp,
  onSelect: onSelectProp,
  disabled,
  label = "Date Picker Range",
}: DatePickerWithRangeProps) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  })

  const date = selectedProp ?? internalDate
  const setDate = onSelectProp ?? setInternalDate

  return (
    <Field className="mx-auto w-60">
      <FieldLabel htmlFor="date-picker-range">{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-range"
            disabled={disabled === true}
            className="justify-start px-2.5 font-normal"
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            disabled={disabled !== true ? disabled : undefined}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}