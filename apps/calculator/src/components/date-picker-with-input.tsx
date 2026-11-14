"use client";

import { useDateFormat } from "@greendex/i18n/datetime/client";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerWithInputProps {
  id: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
}

function DatePickerWithInput({
  id,
  value,
  onChange,
  placeholder,
}: DatePickerWithInputProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date | undefined>(value);
  const format = useDateFormat();

  return (
    <div className="relative flex gap-2">
      <Input
        /* eslint-disable-next-line shadcn/no-restyle -- Date picker reserves space for its calendar affordance. */
        className="cursor-pointer bg-background pr-10"
        id={id}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        placeholder={placeholder ?? format.pattern()}
        readOnly
        type="text"
        value={value ? format.format(value, "date.numeric") : ""}
      />
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className="absolute top-1/2 right-1 size-7.5 -translate-y-1/2"
            type="button"
            variant="ghost"
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">Select date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          alignOffset={-8}
          className="w-auto overflow-hidden p-0"
          sideOffset={10}
        >
          <Calendar
            captionLayout="dropdown"
            formatters={{
              // The vendored calendar abbreviates months with the host locale;
              // the popover must follow the active request locale instead.
              formatMonthDropdown: (date) =>
                format.format(date, "date.monthShort"),
            }}
            mode="single"
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            selected={value}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { DatePickerWithInput, type DatePickerWithInputProps };
