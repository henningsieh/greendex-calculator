import { cn } from "@/lib/utils";

/* TerminalCard — brand extension (ember-c-spec.md). The surface is a dark
   console in every theme, so it reads the terminal tokens instead of the page's
   muted foreground: that pair measured 2.3:1 on the light theme's navy. */
function TerminalCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="terminal-card"
      className={cn(
        "rounded-2xl border border-border bg-term font-mono text-[13px] leading-[2.1] text-term-muted",
        className,
      )}
      {...props}
    />
  );
}

function TerminalDots() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      <span className="size-3 rounded-full bg-brand" />
      <span className="size-3 rounded-full bg-term-muted/40" />
      <span className="size-3 rounded-full bg-term-muted/40" />
    </div>
  );
}

function TerminalStatus({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="terminal-status"
      className={cn("font-mono text-[13px] text-brand", className)}
      {...props}
    />
  );
}

export { TerminalCard, TerminalDots, TerminalStatus };
