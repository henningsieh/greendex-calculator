import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const accountingAppearance = "h-11 rounded-sm border-input bg-card px-3 focus-visible:border-ring focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring";

const inputVariants = cva(
  "h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-base transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive md:text-sm dark:aria-invalid:border-b-destructive/50",
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
