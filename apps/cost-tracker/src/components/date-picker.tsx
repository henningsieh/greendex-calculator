"use client";

import { useTranslations } from "@greendex/i18n/client";
import {
  fromCalendarDate,
  toCalendarDate,
  toDateInputValue,
} from "@greendex/i18n/datetime";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value?: Date;
  onChange: (value: Date | undefined) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  clearable?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean | "true" | "false";
  "data-testid"?: string;
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  disabled = false,
  minDate,
  clearable = false,
  ref,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
  "data-testid": dataTestId,
}: DatePickerProps) {
  const t = useTranslations("shell.datePicker");
  const dateFormat = useDateFormat();
  const [open, setOpen] = useState(false);
  const selected = toCalendarDate(value);
  const minimum = toCalendarDate(minDate);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            ref={ref}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-required={ariaRequired}
            data-testid={dataTestId}
            disabled={disabled}
            id={id}
            type="button"
            variant="field"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate">
            {value
              ? dateFormat.format(value, "date.medium")
              : (placeholder ?? t("placeholder"))}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto"
        data-testid={dataTestId ? `${dataTestId}-popover` : undefined}
      >
        <Calendar
          key={toDateInputValue(value) || "empty"}
          defaultMonth={selected ?? minimum}
          disabled={minimum ? { before: minimum } : undefined}
          formatters={{
            formatCaption: (date) =>
              dateFormat.formatLocal(date, "date.monthYear"),
            formatWeekdayName: (date) =>
              dateFormat.formatLocal(date, "date.weekdayShort"),
          }}
          labels={{
            labelDayButton: (date) => dateFormat.formatLocal(date, "date.full"),
            labelGrid: () => t("calendar"),
            labelNav: () => t("calendar"),
            labelNext: () => t("nextMonth"),
            labelPrevious: () => t("previousMonth"),
            labelWeekday: (date) =>
              dateFormat.formatLocal(date, "date.weekdayLong"),
          }}
          mode="single"
          onSelect={(date) => {
            onChange(date ? fromCalendarDate(date) : undefined);
            setOpen(false);
          }}
          selected={selected}
          weekStartsOn={1}
        />
        {clearable && value ? (
          <Button
            data-testid={dataTestId ? `${dataTestId}-clear` : undefined}
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
