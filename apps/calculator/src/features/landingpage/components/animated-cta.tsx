import { ChevronRightIcon } from "lucide-react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { cn } from "@/lib/utils";

interface AnimatedGradientCTAProps {
  leftEmoji: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedGradientCTA({
  leftEmoji,
  children,
  className,
}: AnimatedGradientCTAProps) {
  return (
    <div
      className={cn(
        "group relative mx-auto flex items-center justify-center rounded-full px-3 py-2.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 block size-full animate-gradient rounded-[inherit] bg-linear-to-r from-primary/60 via-secondary/60 to-primary/60 bg-size-[300%_100%] p-px",
        )}
        style={{
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "destination-out",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "subtract",
          WebkitClipPath: "padding-box",
        }}
      />
      {leftEmoji} <hr className="mx-2 h-4 w-px shrink-0 bg-neutral-500" />
      <AnimatedGradientText
        className="flex items-center justify-center self-center text-center text-sm font-extrabold sm:text-base md:text-lg lg:text-xl"
        colorFrom="oklch(0.8296 0.1495 148.9899)"
        colorTo="var(--secondary)"
      >
        {children}
      </AnimatedGradientText>
      <div className="ml-3 size-6 shrink-0 overflow-hidden rounded-full bg-secondary/40 duration-500 ease-in-out group-hover:bg-primary/80">
        <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
          <span className="flex size-6">
            <ChevronRightIcon className="m-auto size-3 stroke-foreground" />
          </span>
          <span className="flex size-6">
            <ChevronRightIcon className="m-auto size-3 stroke-muted-foreground" />
          </span>
        </div>
      </div>
    </div>
  );
}
