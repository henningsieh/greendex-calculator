import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Announces a loading region without smuggling its content into a phrasing
 * element. `<output>` only accepts phrasing content, so the status text sits
 * in its own `sr-only` output and the landmarks and blocks beside it.
 */
export function LoadingRegion({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <>
      <output className="sr-only" aria-label={label} aria-live="polite">
        {label}
      </output>
      {children}
    </>
  );
}

/**
 * Mirrors `ProtectedPageHeader` block for block: the eyebrow's 18px mono line
 * box, the `mt-2` title line (40px at `text-4xl`), and the `mt-4`
 * `text-sm/8` description. Only one description line is sketched; the
 * resolved copy wraps to two only on narrow viewports.
 *
 * The geometry matters: this skeleton is the shell's own `main` fallback, so
 * a mismatched height makes the page jump when the route's header replaces it.
 */
export function ProtectedPageHeaderLoading({
  rightButton,
}: {
  /** Trailing action slot, mirroring `ProtectedPageHeader`'s `rightButton`. */
  rightButton?: React.ReactNode;
} = {}) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-3xl min-w-0">
        <p className="type-ember-eyebrow" aria-hidden="true">
          <span
            className="inline-block h-3 w-28 animate-pulse bg-muted"
            data-testid="loading-skeleton"
          />
        </p>
        <Skeleton
          className="mt-2 h-10 w-72 max-w-full"
          data-testid="loading-skeleton"
        />
        {/* `text-sm/8` = one 32px line box. Reserving a single line keeps the
            common case exact; long copy that wraps on a narrow viewport grows
            by one line when it resolves. */}
        <div className="mt-4 flex h-8 items-center">
          <Skeleton
            className="h-4 w-full max-w-xl"
            data-testid="loading-skeleton"
          />
        </div>
      </div>
      {rightButton ? <div className="shrink-0">{rightButton}</div> : null}
    </header>
  );
}

export function CardLoading({
  variant = "default",
  rows = 3,
}: {
  variant?: "default" | "document" | "action";
  rows?: number;
}) {
  return (
    <Card variant={variant}>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-48 max-w-full" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex flex-col gap-2" key={index}>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Navigation fallback adds the header absent from an inner section fallback. */
export function ProjectDataPageLoading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ProtectedPageHeaderLoading />
      {children}
    </div>
  );
}
