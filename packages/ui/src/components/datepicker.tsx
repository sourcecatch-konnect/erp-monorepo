"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DayPicker } from "react-day-picker"

import { Button } from "./button"
import { Calendar } from "./calender"
import { Field, FieldLabel } from "./Field"
import { Popover, PopoverContent, PopoverTrigger } from "./popver"

interface DatePickerProps {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: boolean | React.ComponentProps<typeof DayPicker>["disabled"]
  label?: string
}

export function DatePicker({
  selected: selectedProp,
  onSelect: onSelectProp,
  disabled,
  label = "Date",
}: DatePickerProps) {
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(undefined)

  const date = selectedProp ?? internalDate
  const setDate = onSelectProp ?? setInternalDate

  return (
    <Field className="mx-auto w-60">
      <FieldLabel htmlFor="date-picker">{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker"
            disabled={disabled === true}
            className="justify-start px-2.5 font-normal"
          >
            <CalendarIcon />
            {date ? format(date, "LLL dd, y") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={disabled !== true ? disabled : undefined}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}