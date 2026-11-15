"use client";

import * as Flags from "country-flag-icons/react/3x2";

/**
 * One country-flag presentation for every surface: a bordered 3:2 tile with
 * the flag filling it. Country codes stay ISO domain values; this only
 * renders them. (`country-flag-icons` ships per-country components, so an
 * unknown code renders nothing rather than a broken box.)
 */
export function CountryFlag({ code }: { code: string }) {
  const Flag = Flags[code as keyof typeof Flags] as
    | React.ComponentType<{
        className?: string;
        focusable?: string;
        "aria-hidden"?: boolean;
      }>
    | undefined;
  if (!Flag) return null;
  return (
    <span className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-sm border border-border">
      <Flag aria-hidden={true} focusable="false" className="size-full" />
    </span>
  );
}
