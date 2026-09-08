"use client";

import { useLocale } from "@greendex/i18n/client";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAllCountries, getEUCountries } from "@/lib/i18n/countries";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  euOnly?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Country select component with flag icons and localized country names
 *
 * @example
 * ```tsx
 * <CountrySelect
 *   value={country}
 *   onValueChange={setCountry}
 *   euOnly={true}
 *   placeholder="Select a country..."
 * />
 * ```
 */
export function CountrySelect({
  value,
  onValueChange,
  euOnly = false,
  placeholder = "Select country...",
  className,
  disabled = false,
}: CountrySelectProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const countries = useMemo(
    () => (euOnly ? getEUCountries(locale) : getAllCountries(locale)),
    [euOnly, locale],
  );

  const selectedCountry = countries.find((country) => country.code === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          role="combobox"
          variant="outline"
        >
          {selectedCountry ? (
            <span className="flex items-center gap-2">
              {selectedCountry.Flag && (
                <selectedCountry.Flag className="h-4 w-6 rounded-sm border border-border/20" />
              )}
              <span>{selectedCountry.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-75 p-0">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  keywords={[country.name, country.code]}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  value={country.code}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === country.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {country.Flag && (
                    <country.Flag className="mr-2 h-4 w-6 rounded-sm border border-border/20" />
                  )}
                  <span>{country.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {country.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
