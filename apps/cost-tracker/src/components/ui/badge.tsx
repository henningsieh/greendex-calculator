import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-xl border-0 bg-transparent px-0 py-0 text-[0.625rem] font-semibold tracking-widest whitespace-nowrap uppercase transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Semantic chips carry a fill and a hairline so state reads at a
        // glance; ghost and link stay typographic on purpose.
        "claim-status": "border border-claim-band-foreground px-3 py-1 text-base tracking-normal whitespace-normal text-claim-band-foreground normal-case",
        // Sentence-case Claim state for light document surfaces: a neutral
        // chip with a semantic status dot, never a stamped uppercase label.
        "claim-state": "gap-2 border border-border bg-card px-3 py-1.5 text-sm tracking-normal whitespace-normal text-foreground normal-case",
        default:
          "border border-transparent bg-primary px-2.5 py-1 text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border border-border bg-muted px-2.5 py-1 text-muted-foreground [a]:hover:text-foreground",
        destructive:
          "border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border border-border bg-transparent px-2.5 py-1 text-foreground [a]:hover:bg-accent",
        // Same box as a chip, no fill or hairline: aligns with its neighbours.
        ghost:
          "border border-transparent px-2.5 py-1 text-muted-foreground [a]:hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        // The name is the brief: the ember accent, not a neutral card chip.
        "ember-pill":
          "rounded-full border border-brand/45 bg-brand/15 px-4 py-1.5 text-[11px] tracking-[0.2em] text-foreground normal-case shadow-[inset_0_1px_0_var(--glass-edge)]",
        "status-pass":
          "border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary",
        // Amber attention: work waits on someone, but nothing is wrong.
        "status-attention":
          "border border-brand/45 bg-brand/15 px-2.5 py-1 text-foreground",
        // Settled-positive tints; the solid forms mark terminal states.
        "status-success":
          "border border-success/40 bg-success/10 px-2.5 py-1 text-foreground",
        "status-correction":
          "border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-foreground",
        "status-success-solid":
          "border border-transparent bg-success px-2.5 py-1 text-success-foreground",
        // Terminal-negative: the hairline tint is correction, this is final.
        "status-destructive-solid":
          "border border-transparent bg-red-800 px-2.5 py-1 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
