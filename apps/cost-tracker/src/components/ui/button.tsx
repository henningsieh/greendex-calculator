import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/* Ember button system (ember-c-spec.md, LOCKED 2026-10-11), implemented
   shadcn-idiomatically. Semantic tokens only — no raw values.
   - default: fire surface, pill, lift (-2px hover, hover-gated) + press .97.
   - ghost: transparent, 1px line, hover = 6% white wash + fire border.
   - pending: NO isPending prop (shadcn Critical Rules) — compose
     <PendingButton> (Spinner + disabled + data-disabled) instead.
     Color-mix 45% fire, no opacity dimming (would dim the glow).
   - cta: landing-page main CTA only; breathes via the .ember-cta glow layer
     (opacity-only animation, never box-shadow — Emil performance rule).
   Hover/press feedback applies to enabled buttons only (:enabled / :not(:disabled)).
   data-disabled (not :has()) marks exempt cells; .calm zones stay static. */
const buttonFeedback =
  "rounded-full text-sm tracking-normal normal-case whitespace-normal text-center transition-[transform,background-color,border-color,box-shadow] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:ring-0 motion-reduce:transition-none";
const primaryFeedback =
  "border-primary-border bg-primary text-primary-foreground shadow-primary-glow fine-hover:enabled:-translate-y-0.5 fine-hover:enabled:bg-primary-active fine-hover:enabled:shadow-primary-glow focus-visible:border-brand focus-visible:shadow-primary-glow active:enabled:scale-[.97] active:enabled:bg-primary-active motion-reduce:fine-hover:enabled:translate-y-0 motion-reduce:active:enabled:scale-100";
const ghostFeedback =
  "border-border bg-transparent text-foreground fine-hover:enabled:bg-accent fine-hover:enabled:border-brand focus-visible:border-brand active:enabled:scale-[.97] motion-reduce:active:enabled:scale-100";
const pendingFeedback =
  "cursor-not-allowed border-transparent bg-pending text-pending-foreground shadow-secondary-glow";
const ctaFeedback =
  "ember-cta border-primary-border bg-primary text-primary-foreground shadow-primary-glow fine-hover:enabled:-translate-y-0.5 fine-hover:enabled:bg-primary-active focus-visible:border-brand active:enabled:scale-[.97] motion-reduce:active:enabled:scale-100";

const defaultButtonStyle = `${buttonFeedback} ${primaryFeedback}`;
const outlineButtonStyle = `${buttonFeedback} ${ghostFeedback}`;

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding px-6 text-xs font-semibold tracking-widest whitespace-nowrap uppercase transition-[transform,background-color,border-color,box-shadow] outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:data-[variant=default]:bg-pending disabled:data-[variant=default]:text-pending-foreground disabled:data-[variant=default]:shadow-secondary-glow disabled:data-[variant=outline]:bg-muted disabled:data-[variant=outline]:text-muted-foreground disabled:data-[variant=ghost]:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: defaultButtonStyle,
        outline: outlineButtonStyle,
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: ghostFeedback,
        pending: `${buttonFeedback} ${pendingFeedback}`,
        cta: `${buttonFeedback} ${ctaFeedback}`,
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline underline-offset-4 hover:underline",
      },
      size: {
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
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
