import { cn } from "@/lib/utils";

/* StarWreath — brand mark (LOCKED 2026-10-11, never modified).
   12 fire dots, EU symbolism. Custom SVG icon component (no shadcn slot). */
const DOTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
});

function StarWreath({
  className,
  size = 34,
  ...props
}: React.ComponentProps<"svg"> & { size?: number }) {
  return (
    <svg
      data-slot="star-wreath"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="GreenEx star wreath"
      className={cn("shrink-0", className)}
      {...props}
    >
      {DOTS.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={7} fill="var(--brand)" />
      ))}
    </svg>
  );
}

export { StarWreath };
