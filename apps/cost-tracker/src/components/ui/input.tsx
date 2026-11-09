import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const accountingAppearance = "h-11 rounded-xl border-input bg-card px-3 focus-visible:border-ring focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring";

const inputVariants = cva(
  "h-10 w-full min-w-0 rounded-xl border border-input bg-input/30 px-3 py-2 text-base transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        accounting: accountingAppearance,
        figure: `${accountingAppearance} font-mono tabular-nums`,
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Input({ className, type, variant = "default", ...props }: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input };
