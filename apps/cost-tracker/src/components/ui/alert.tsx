import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-1 border bg-background px-4 py-3 text-left text-sm after:absolute after:-inset-y-px after:-left-px after:w-0.5 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground after:bg-foreground",
        destructive:
          "bg-card text-destructive after:bg-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        accent:
          "border-primary/25 bg-primary/10 text-foreground after:bg-primary *:data-[slot=alert-description]:text-foreground/80 [&_kbd]:bg-primary/15 [&_kbd]:text-foreground",
        info:
          "border-primary/25 bg-accent text-accent-foreground after:bg-primary *:data-[slot=alert-description]:text-accent-foreground *:[svg]:text-current",
      },
      emphasis: {
        default: "",
        prominent:
          "min-w-0 gap-3 px-6 py-5 wrap-anywhere after:w-1 has-data-[slot=alert-action]:pr-6 has-[>svg]:gap-x-3 *:min-w-0 *:data-[slot=alert-title]:text-base *:data-[slot=alert-description]:text-base/relaxed *:data-[slot=alert-action]:static *:data-[slot=alert-action]:col-span-full *:data-[slot=alert-action]:flex *:data-[slot=alert-action]:flex-wrap *:data-[slot=alert-action]:gap-2 *:data-[slot=alert-action]:pt-1 *:[svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      emphasis: "default",
    },
  }
)

function Alert({
  className,
  variant,
  emphasis,
  role = variant === "info" ? "status" : "alert",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-emphasis={emphasis ?? "default"}
      role={role}
      className={cn(alertVariants({ variant, emphasis }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-sm font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2.5 right-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
