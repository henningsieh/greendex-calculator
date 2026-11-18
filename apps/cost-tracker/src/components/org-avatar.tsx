import { cn } from "cn";

/** First letters of the first two words, uppercased ("Seed Organization" → "SO"). */
export function organizationInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * Organization avatar: initials on the primary tint. Decorative — the
 * adjacent name carries the accessible identity, so this is hidden.
 */
export function OrgAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold tracking-wide text-primary",
        className,
      )}
    >
      {organizationInitials(name)}
    </span>
  );
}
