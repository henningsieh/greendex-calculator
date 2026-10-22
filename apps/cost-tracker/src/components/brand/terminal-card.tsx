import { cn } from "@/lib/utils";

/* TerminalCard — brand extension (ember-c-spec.md). Basis #080510 only in
   Ember themes; elsewhere it falls back to --popover so light stays calm. */
function TerminalCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="terminal-card"
      className={cn(
        "rounded-2xl border border-border bg-term font-mono text-[13px] leading-[2.1] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TerminalDots() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      <span className="size-3 rounded-full bg-primary" />
      <span className="size-3 rounded-full bg-muted-foreground/40" />
      <span className="size-3 rounded-full bg-muted-foreground/40" />
    </div>
  );
}

function TerminalStatus({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="terminal-status"
      className={cn("font-mono text-[13px] text-primary", className)}
      {...props}
    />
  );
}

export { TerminalCard, TerminalDots, TerminalStatus };
