import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* StatGrid — the seamless stat raster (LOCKED 2026-10-11). Brand extension:
   shadcn Card wants gapped cards; this is one container, dividers only by
   1px lines, no gaps. Exactly one hero cell carries the amber wash. */
const statGridVariants = cva(
  "overflow-hidden rounded-xl border border-border bg-card shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]",
  {
    variants: {
      columns: {
        three: "grid grid-cols-2 md:grid-cols-3",
        two: "grid grid-cols-2",
      },
    },
    defaultVariants: { columns: "three" },
  },
);

function StatGrid({
  className,
  columns,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statGridVariants>) {
  return (
    <div
      data-slot="stat-grid"
      className={cn(statGridVariants({ columns }), className)}
      {...props}
    />
  );
}

const statCellVariants = cva("p-9 max-sm:p-5", {
  variants: {
    hero: {
      true: "bg-[linear-gradient(180deg,rgb(255_184_0/0.13),transparent_75%)]",
      false: "",
    },
  },
  defaultVariants: { hero: false },
});

function StatCell({
  className,
  hero,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statCellVariants>) {
  return (
    <div
      data-slot="stat-cell"
      data-hero={hero ? "true" : undefined}
      className={cn(
        "border-r border-b border-border [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0",
        statCellVariants({ hero }),
        className,
      )}
      {...props}
    />
  );
}

function StatNumber({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-number"
      className={cn("type-ember-stat-number text-foreground", className)}
      {...props}
    />
  );
}

function StatLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-label"
      className={cn(
        "font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function StatDetail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-detail"
      className={cn("font-mono text-xs text-muted-foreground/70", className)}
      {...props}
    />
  );
}

export { StatGrid, StatCell, StatNumber, StatLabel, StatDetail };
