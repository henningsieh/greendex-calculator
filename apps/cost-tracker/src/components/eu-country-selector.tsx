"use client";

import type { EUCountryCode } from "@greendex/config/eu-countries";
import { useLocale, useTranslations } from "@greendex/i18n/client";
import { useMemo, type ComponentProps } from "react";

import { CountryFlag } from "@/components/country-flag";
import { getEUCountryOptions } from "@/components/eu-country-names";
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

type EUCountrySelectorProps = Pick<
  ComponentProps<typeof ComboboxTrigger>,
  | "id"
  | "ref"
  | "onBlur"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "aria-required"
  | "className"
> & {
  value: EUCountryCode | "";
  onValueChange: (value: EUCountryCode | "") => void;
  disabled?: boolean;
  optional?: boolean;
  name?: string;
  "data-testid"?: string;
};

type EUCountryOption = ReturnType<typeof getEUCountryOptions>[number];

function CountryPresentation({ country }: { country: EUCountryOption }) {
  return (
    <>
      {country.code && <CountryFlag code={country.code} />}
      {country.label}
    </>
  );
}

export function EUCountrySelector({
  value,
  onValueChange,
  disabled = false,
  optional = false,
  variant = "default",
  name,
  ...props
}: EUCountrySelectorProps & { variant?: "default" | "field" }) {
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
      required={!optional}
      name={name}
    >
      <ComboboxTrigger
        render={<Button variant={variant === "field" ? "field" : "outline"} />}
        {...props}
      >
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
