import { cn } from "@/lib/utils";

/* Aura — the single static radial glow above the hero (LOCKED 2026-10-11).
   animation:none — slow large layout-shifting animations are forbidden. */
function Aura({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="aura"
      aria-hidden="true"
      className={cn("ember-aura pointer-events-none", className)}
      {...props}
    />
  );
}

export { Aura };
