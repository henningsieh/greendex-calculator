import type { ReactNode } from "react";

import type { AppHref } from "@/app/routes";
import { SiteBrand } from "@/components/site-brand";
import { cn } from "@/lib/utils";

export const protectedFrameClassName =
  "min-h-svh w-full min-w-0 bg-muted/35 [--frame-gutter:--spacing(8)] [--frame-end:--spacing(8)] min-[22.5rem]:[--frame-gutter:--spacing(9)] min-[22.5rem]:[--frame-end:--spacing(5)] sm:[--frame-end:--spacing(8.5)] lg:[--frame-gutter:--spacing(10)] lg:[--frame-end:--spacing(10)]";

export const protectedMainClassName =
  "@container/content mx-auto w-full max-w-7xl py-2 ps-(--frame-gutter) pe-(--frame-end) lg:py-4";

export function AppHeaderRow({
  leading,
  brandHref,
  children,
}: {
  leading?: ReactNode;
  brandHref?: AppHref;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-18 w-full max-w-7xl items-center",
        leading ? "pe-(--frame-end)" : "px-5 sm:px-8 lg:px-10",
      )}
    >
      {leading && (
        <div className="flex w-(--frame-gutter) shrink-0 items-center justify-center">
          {leading}
        </div>
      )}
      <SiteBrand href={brandHref} />
      <div className="ms-auto flex items-center">{children}</div>
    </div>
  );
}
