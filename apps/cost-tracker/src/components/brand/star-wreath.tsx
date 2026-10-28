import { cn } from "@/lib/utils";

/* StarWreath — brand mark. 12 fire dots, EU symbolism. Custom SVG icon
   component (no shadcn slot). Coordinates are rounded to three decimals so
   server and client serialize identical markup. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const DOTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return {
    x: round3(40 + 26 * Math.cos(angle)),
    y: round3(40 + 26 * Math.sin(angle)),
  };
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
      viewBox="0 0 80 80"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- Inline SVG needs a named image role; img cannot preserve its brand CSS variables and SVG props. Maintainer-approved exception.
      role="img"
      aria-label="GreenDex star wreath"
      className={cn("shrink-0", className)}
      {...props}
    >
      {DOTS.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={5} fill="var(--brand)" />
      ))}
    </svg>
  );
}

export { StarWreath };
