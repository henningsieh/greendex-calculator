import type { ComponentProps, ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Page section tabs (Account settings, Hosted/Partner scope, Partner
 * Organizations). One underlined `line` rhythm at one position so section
 * tabs are pixel-perfect across pages.
 *
 * Style and position are locked here, not at call sites:
 * - `SectionTabsWrapper` owns the `mt-10` distance from the page header.
 * - `SectionTabsRow` owns the trailing-accessory row
 *   (`flex flex-wrap items-center justify-between gap-x-6 gap-y-3`).
 * - `SectionTabsList` / `SectionTabsTrigger` hard-code `variant="line"`
 *   (`text-sm`). The `variant` and `className` props are omitted from their
 *   APIs so a caller cannot pick a different size again.
 *
 * Use this family for every page section tab. Raw `Tabs` with
 * `variant="line"` is not a section tab.
 */

type SectionTabsProps = Omit<
  ComponentProps<typeof Tabs>,
  "className" | "orientation"
>;

export function SectionTabs(props: SectionTabsProps) {
  return <Tabs orientation="horizontal" {...props} />;
}

export function SectionTabsWrapper({ children }: { children: ReactNode }) {
  return <div className="mt-10">{children}</div>;
}

export function SectionTabsRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      {children}
    </div>
  );
}

type SectionTabsListProps = Omit<
  ComponentProps<typeof TabsList>,
  "className" | "variant"
>;

export function SectionTabsList(props: SectionTabsListProps) {
  return <TabsList variant="line" {...props} />;
}

type SectionTabsTriggerProps = Omit<
  ComponentProps<typeof TabsTrigger>,
  "className" | "variant"
>;

export function SectionTabsTrigger(props: SectionTabsTriggerProps) {
  return <TabsTrigger variant="line" {...props} />;
}

export function SectionTabsContent(props: ComponentProps<typeof TabsContent>) {
  return <TabsContent {...props} />;
}
