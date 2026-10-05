import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Accounting feedback swaps the existing border: no solid-edge growth or layout shift.
const accountingFeedback = "rounded-sm text-sm tracking-normal normal-case whitespace-normal text-center transition-transform duration-140 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:ring-0 active:not-aria-[haspopup]:translate-y-0 active:enabled:scale-[.97] motion-reduce:transition-none motion-reduce:active:enabled:scale-100";
const primaryFeedback = "border-primary-border bg-primary text-primary-foreground fine-hover:enabled:bg-primary-hover fine-hover:enabled:border-brand fine-hover:enabled:shadow-primary-glow focus-visible:border-brand focus-visible:shadow-primary-glow active:enabled:bg-primary-hover active:enabled:border-brand active:enabled:shadow-primary-glow";
const secondaryFeedback = "border-input bg-card text-foreground fine-hover:enabled:bg-secondary-hover fine-hover:enabled:text-secondary-hover-foreground fine-hover:enabled:border-brand fine-hover:enabled:shadow-secondary-glow focus-visible:border-brand focus-visible:shadow-secondary-glow active:enabled:bg-secondary-hover active:enabled:text-secondary-hover-foreground active:enabled:border-brand active:enabled:shadow-secondary-glow";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent bg-clip-padding text-xs font-semibold tracking-widest whitespace-nowrap uppercase transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        accounting: `${accountingFeedback} ${primaryFeedback}`,
        "accounting-outline": `${accountingFeedback} ${secondaryFeedback}`,
        default: "bg-primary text-primary-foreground fine-hover:enabled:bg-primary-hover",
        outline:
          "border-border bg-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline underline-offset-4 hover:underline",
      },
      size: {
        accounting: "min-h-11 h-auto gap-2 px-4 py-2",
        default:
          "h-10 gap-1.5 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-11 gap-1.5 px-8 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
