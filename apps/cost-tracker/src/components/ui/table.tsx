"use client"

import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "cn"

const accountingCellAppearance = "h-auto px-3 py-2.5 align-top whitespace-normal wrap-anywhere"

const tableVariants = cva(
  "w-full caption-bottom text-sm",
  {
    variants: {
      variant: {
        default: "",
        accounting: "min-w-180 table-fixed caption-top",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const tableHeadVariants = cva(
  "h-12 px-3 text-left align-middle text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase has-[[role=checkbox]]:pr-0",
  {
    variants: {
      variant: {
        default: "",
        accounting: `${accountingCellAppearance} bg-muted text-sm font-semibold tracking-normal text-foreground normal-case`,
        amount: `${accountingCellAppearance} bg-muted text-sm font-semibold tracking-normal text-foreground normal-case text-right whitespace-nowrap`,
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const tableCellVariants = cva(
  "p-3 align-middle whitespace-nowrap has-[[role=checkbox]]:pr-0",
  {
    variants: {
      variant: {
        default: "",
        accounting: accountingCellAppearance,
        amount: `${accountingCellAppearance} text-right whitespace-nowrap font-mono tabular-nums`,
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Table({ className, variant = "default", ...props }: React.ComponentProps<"table"> & VariantProps<typeof tableVariants>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
      role={variant === "accounting" ? "region" : undefined}
      aria-label={variant === "accounting" ? "Travel Cost Entries table, horizontally scrollable" : undefined}
      tabIndex={variant === "accounting" ? 0 : undefined}
    >
      <table
        data-slot="table"
        className={cn(tableVariants({ variant }), className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, variant = "default", ...props }: React.ComponentProps<"th"> & VariantProps<typeof tableHeadVariants>) {
  return (
    <th
      data-slot="table-head"
      className={cn(tableHeadVariants({ variant }), className)}
      {...props}
    />
  )
}

function TableCell({ className, variant = "default", ...props }: React.ComponentProps<"td"> & VariantProps<typeof tableCellVariants>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(tableCellVariants({ variant }), className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
