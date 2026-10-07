"use client";

import { WORKSHOPS } from "@greendex/config/workshops";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkshopDetails } from "@/features/landingpage/components/workshops/workshop-details";
import type { WorkshopType } from "@/features/landingpage/types";

/**
 * Render a three-tab workshop interface synchronized with the URL `type` query parameter.
 *
 * The selected tab is derived from the `type` query parameter and falls back to `initialType`
 * when the query parameter is absent or invalid.
 *
 * @param initialType - Default calculator type to use when the `type` query parameter is not present
 * @returns A React element that renders tabbed workshop details for the selected calculator type
 */
export function WorkshopContent({ initialType }: { initialType: WorkshopType }) {
  const [type, setType] = useQueryState(
    "type",
    parseAsStringLiteral(["moment", "deal", "day"] as const).withDefault(
      initialType,
    ),
  );

  return (
    <Tabs
      data-testid="workshops-content"
      onValueChange={(value) => setType(value as WorkshopType)}
      value={type}
    >
      <TabsList className="grid w-full grid-cols-3 bg-secondary/40">
        <TabsTrigger
          className="focus-visible:border-secondary focus-visible:ring-secondary/50 focus-visible:outline-secondary dark:text-secondary-foreground dark:data-[state=active]:border-secondary dark:data-[state=active]:bg-secondary/30 dark:data-[state=active]:text-foreground"
          value="moment"
        >
          {WORKSHOPS.MOMENT.name}
        </TabsTrigger>
        <TabsTrigger
          className="focus-visible:border-secondary focus-visible:ring-secondary/50 focus-visible:outline-secondary dark:text-secondary-foreground dark:data-[state=active]:border-secondary dark:data-[state=active]:bg-secondary/30 dark:data-[state=active]:text-foreground"
          value="deal"
        >
          {WORKSHOPS.DEAL.name}
        </TabsTrigger>
        <TabsTrigger
          className="focus-visible:border-secondary focus-visible:ring-secondary/50 focus-visible:outline-secondary dark:text-secondary-foreground dark:data-[state=active]:border-secondary dark:data-[state=active]:bg-secondary/30 dark:data-[state=active]:text-foreground"
          value="day"
        >
          {WORKSHOPS.DAY.name}
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-8" value="moment">
        <WorkshopDetails type="moment" />
      </TabsContent>

      <TabsContent className="mt-8" value="deal">
        <WorkshopDetails type="deal" />
      </TabsContent>

      <TabsContent className="mt-8" value="day">
        <WorkshopDetails type="day" />
      </TabsContent>
    </Tabs>
  );
}
