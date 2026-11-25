import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared layout for resolved metrics and their loading placeholders. */
export function ProjectMetrics({
  columns,
  children,
  ...props
}: {
  columns: "two" | "three";
  children: ReactNode;
  "aria-busy"?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <dl
      className={cn(
        "grid divide-x rounded-xl border bg-card",
        columns === "three" ? "grid-cols-3" : "grid-cols-2",
      )}
      {...props}
    >
      {children}
    </dl>
  );
}
