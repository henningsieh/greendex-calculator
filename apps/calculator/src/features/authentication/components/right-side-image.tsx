"use client";

import { motion, stagger } from "motion/react";
import Image from "next/image";
import { useId } from "react";

import { AnimatedGroup } from "@/components/animated-group";
import { cn } from "@/lib/utils";

interface RightSideImageProps {
  headline: string;
  description: string;
  highlights: string[];
  heroBadge: string;
  heroTitle: string;
  heroCaption: string;
  heroStatOne: string;
  heroStatTwo: string;
}

export function RightSideImage({
  headline,
  description,
  highlights,
  heroBadge,
  heroTitle,
  heroCaption,
  heroStatOne,
  heroStatTwo,
}: RightSideImageProps) {
  const baseId = useId();

  return (
    <div className="relative hidden w-full max-w-xl lg:flex lg:w-1/2 lg:max-w-none">
      <AnimatedGroup
        className={cn(
          "relative flex size-full flex-col gap-6 overflow-hidden border border-border/40 bg-card/30 p-6 backdrop-blur-xl lg:p-8",
        )}
        variants={{
          container: {
            visible: {
              transition: {
                delayChildren: stagger(0.1, { startDelay: 0.2 }),
              },
            },
          },
          item: {
            hidden: { opacity: 0, x: 20, filter: "blur(4px)" },
            visible: {
              opacity: 1,
              x: 0,
              filter: "blur(0px)",
              transition: {
                duration: 0.6,
                ease: "easeOut",
              },
            },
          },
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary)_0%,transparent_60%)] opacity-20" />

        {/* Brand headline and description */}
        <div className="relative z-10 flex flex-col gap-4">
          <h1 className="text-2xl/tight font-semibold text-foreground lg:text-3xl">
            {headline}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {/* Highlights list */}

        <ul className="relative z-10 grid gap-2 text-sm">
          {highlights.map((value, index) => (
            <li
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium backdrop-blur-sm"
              key={`${baseId}-${index}`}
            >
              <span className="size-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              <span className="text-foreground">{value}</span>
            </li>
          ))}
        </ul>

        {/* Hero section */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.4em] text-primary uppercase">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            <span>{heroBadge}</span>
          </div>
          <h3 className="text-xl font-semibold text-foreground">{heroTitle}</h3>
          <p className="text-sm text-muted-foreground">{heroCaption}</p>
        </div>

        {/* Hero image */}
        <motion.div
          className="relative z-10 h-52 w-full overflow-hidden rounded-3xl border border-border/50 bg-muted/30 shadow-lg"
          transition={{ duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
        >
          <Image
            alt="Greendex hero banner showcasing environmental impact calculation platform with focus on eu earasmus projects"
            className="object-cover"
            fill
            sizes="(max-width: 1024px) 100vw, 540px"
            src="/Greendex-hero-banner.png"
          />
        </motion.div>

        {/* Stats */}
        <div className="relative z-10 grid gap-2 text-[0.65rem] tracking-[0.4em] uppercase sm:grid-cols-2">
          <span className="rounded-2xl border border-primary/50 bg-primary/10 px-3 py-2 text-center text-primary backdrop-blur-sm">
            {heroStatOne}
          </span>
          <span className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-2 text-center text-muted-foreground backdrop-blur-sm">
            {heroStatTwo}
          </span>
        </div>
      </AnimatedGroup>
    </div>
  );
}
