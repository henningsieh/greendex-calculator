import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
  {
    variants: {
      tone: {
        default: "",
        teal:
          "border-teal-500/30 bg-linear-to-br from-teal-500/20 to-teal-500/5 backdrop-blur-sm",
        emerald:
          "border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-sm",
        cyan:
          "border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-cyan-500/5 backdrop-blur-sm",
        green:
          "border-green-500/30 bg-linear-to-br from-green-500/20 to-green-500/5 backdrop-blur-sm",
        glass: "border-primary/20 bg-card/50 backdrop-blur-sm",
        danger: "border-red-500/20 bg-red-500/5",
        success: "border-green-500/20 bg-green-500/5",
        subtle: "border-border/60 bg-card/80 shadow-sm",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

function Card({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ tone }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-6", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
