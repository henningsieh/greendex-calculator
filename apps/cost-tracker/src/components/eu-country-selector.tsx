"use client";

import type { EUCountryCode } from "@greendex/config/eu-countries";
import { useLocale, useTranslations } from "@greendex/i18n/client";
import * as Flags from "country-flag-icons/react/3x2";
import { useMemo, type ComponentProps } from "react";

import {
  getEUCountryOptions,
  type EUCountryOption,
} from "@/components/eu-country-names";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

export type EUCountrySelectorProps = Pick<
  ComponentProps<typeof ComboboxTrigger>,
  | "id"
  | "ref"
  | "onBlur"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "className"
> & {
  value: EUCountryCode | "";
  onValueChange: (value: EUCountryCode | "") => void;
  disabled?: boolean;
  optional?: boolean;
  name?: string;
  "data-testid"?: string;
};

function CountryPresentation({ country }: { country: EUCountryOption }) {
  const Flag = country.code ? Flags[country.code] : null;
  return (
    <>
      {Flag && (
        <span className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-border">
          <Flag aria-hidden="true" focusable="false" className="size-full" />
        </span>
      )}
      {country.label}
    </>
  );
}

export function EUCountrySelector({
  value,
  onValueChange,
  disabled = false,
  optional = false,
  name,
  ...props
}: EUCountrySelectorProps) {
  const locale = useLocale();
  const t = useTranslations("shell.countrySelector");
  const countries = useMemo(() => getEUCountryOptions(locale), [locale]);
  const items = optional
    ? [{ code: "" as const, label: t("notSet") }, ...countries]
    : countries;
  const selected = items.find((country) => country.code === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(country) => {
        if (country) onValueChange(country.code);
      }}
      itemToStringLabel={(country) => country.label}
      itemToStringValue={(country) => country.code}
      isItemEqualToValue={(a, b) => a.code === b.code}
      disabled={disabled}
      name={name}
    >
      <ComboboxTrigger render={<Button variant="outline" />} {...props}>
        <ComboboxValue>
          {(country: EUCountryOption | null) =>
            country ? <CountryPresentation country={country} /> : t("placeholder")
          }
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
        />
        <ComboboxEmpty>{t("noMatches")}</ComboboxEmpty>
        <ComboboxList>
          {(country: EUCountryOption) => (
            <ComboboxItem key={country.code} value={country}>
              <CountryPresentation country={country} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
