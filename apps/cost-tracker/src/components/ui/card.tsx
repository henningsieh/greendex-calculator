import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "cn"

const documentAppearance = "gap-5 overflow-visible border-b border-border py-7 text-base shadow-none ring-0 [--card-spacing:--spacing(8)] max-sm:[--card-spacing:--spacing(4)]"

const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden bg-card py-(--card-spacing) text-sm text-card-foreground shadow-sm ring-1 ring-foreground/5 [--card-spacing:--spacing(8)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(5)] *:[img:first-child]:rounded-none *:[img:last-child]:rounded-none",
  {
    variants: {
      variant: {
        default: "",
        document: documentAppearance,
        action: `${documentAppearance} border-0 bg-muted [--card-spacing:--spacing(6)]`,
        "claim-band": "relative flex-row flex-wrap items-start justify-between gap-4 overflow-visible border border-muted-foreground bg-claim-band px-8 py-7 text-base text-claim-band-foreground shadow-none ring-0 before:absolute before:top-7 before:left-0 before:h-12 before:w-2 before:bg-brand before:content-[''] max-sm:px-6 dark:before:w-1",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const cardTitleVariants = cva(
  "font-heading text-lg font-semibold tracking-wider uppercase",
  {
    variants: {
      variant: {
        default: "group-data-[variant=document]/card:text-xl group-data-[variant=document]/card:tracking-normal group-data-[variant=document]/card:normal-case group-data-[variant=action]/card:text-xl group-data-[variant=action]/card:tracking-normal group-data-[variant=action]/card:normal-case group-data-[variant=claim-band]/card:text-2xl group-data-[variant=claim-band]/card:tracking-normal group-data-[variant=claim-band]/card:normal-case sm:group-data-[variant=claim-band]/card:text-[28px]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" } & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-none px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, as: Component = "div", ...props }: React.ComponentProps<"div"> & { as?: "div" | "h2" | "h3" }) {
  return (
    <Component
      data-slot="card-title"
      className={cn(cardTitleVariants(), className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
