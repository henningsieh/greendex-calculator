"use client";

import {
  EU_MEMBER_COUNT,
  type EUCountryCode,
} from "@greendex/config/eu-countries";
import { stagger } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { AnimatedGroup } from "@/components/animated-group";
import { Badge } from "@/components/ui/badge";
import { Globe } from "@/components/ui/globe";
import { EU_CAPITAL_CITIES } from "@/lib/i18n/eu-cities";

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring",
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
} as const;

// Globe configuration
const GLOBE_CONFIG = {
  maxWidth: 640,
  maxHeight: 640,
  initialPhi: 3.5,
  resetPhi: 3.5,
  maxPhi: 5.5,
  theta: 0.66,
  rotationSpeed: 0.003,
  mapSamples: 44_000,
  mapBrightness: 3,
  markerColor: [0.15, 0.65, 0.4] as [number, number, number],
} as const;

/**
 * Globe section component for the landing page
 * Displays an interactive 3D globe showcasing EU member states
 */
export function GlobeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(GLOBE_CONFIG.initialPhi);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: GLOBE_CONFIG.maxWidth,
    height: GLOBE_CONFIG.maxHeight,
  });

  // Measure container and update size (keeps square aspect ratio)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const containerWidth = el.clientWidth || GLOBE_CONFIG.maxWidth;
      const targetWidth = Math.min(containerWidth, GLOBE_CONFIG.maxWidth);
      setSize({
        width: Math.round(targetWidth),
        height: Math.round(targetWidth),
      });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle auto-rotation with phi reset
  const handleRender = useCallback((state: Record<string, any>) => {
    phiRef.current += GLOBE_CONFIG.rotationSpeed;

    // Reset phi if it grows too large to prevent runaway rotation
    if (phiRef.current > GLOBE_CONFIG.maxPhi) {
      phiRef.current = GLOBE_CONFIG.resetPhi;
    }

    state.phi = phiRef.current;
  }, []);
  return (
    <section className="relative py-20 md:py-32">
      <div className="container mx-auto max-w-7xl px-6">
        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: {
                  delayChildren: stagger(0.05, { startDelay: 0.1 }),
                },
              },
            },
            ...transitionVariants,
          }}
        >
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left side - Text content */}
            <div className="space-y-6">
              <Badge
                className="border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold tracking-wider text-primary uppercase"
                variant="default"
              >
                Global Impact
              </Badge>

              <h2 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                Across Europe,{" "}
                <span className="bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                  Together
                </span>
              </h2>

              <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                Greendex connects organizations across all {EU_MEMBER_COUNT} EU
                member states, creating a unified network dedicated to
                environmental sustainability and green initiatives.
              </p>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">
                    {EU_MEMBER_COUNT}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    EU Member States
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">450M+</div>
                  <p className="text-sm text-muted-foreground">
                    Potential Participants
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                {(
                  [
                    "AT", // Austria
                    "BE", // Belgium
                    "DE", // Germany
                    "FR", // France
                    "IT", // Italy
                    "ES", // Spain
                    "PL", // Poland
                    "NL", // Netherlands
                  ] satisfies EUCountryCode[]
                ).map((countryCode) => {
                  const city = EU_CAPITAL_CITIES.find(
                    (c) => c.countryCode === countryCode,
                  );
                  if (!city) {
                    return null;
                  }
                  return (
                    <Badge
                      variant="outline"
                      className="border-primary/90 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                      key={countryCode}
                    >
                      {city.name}
                    </Badge>
                  );
                })}
                <Badge
                  className="border-primary/90 bg-primary/30 px-3 py-1 text-xs font-semibold text-primary-foreground/50"
                  variant="default"
                >
                  +{EU_MEMBER_COUNT - 8} more
                </Badge>
              </div>
            </div>

            {/* Right side - Globe */}
            <div className="relative flex items-center justify-center">
              <div
                ref={containerRef}
                className="relative mx-auto flex w-full max-w-120 items-center justify-center md:max-w-200"
              >
                {/* Glow effect behind globe */}
                <div className="absolute inset-0 -z-10 rounded-full bg-linear-to-br from-emerald-400/20 via-teal-500/20 to-cyan-400/20 blur-3xl dark:from-emerald-500/30 dark:via-teal-600/30 dark:to-cyan-500/30" />
                {/* Globe component */}
                <Globe
                  cities={EU_CAPITAL_CITIES}
                  className="mx-auto w-full"
                  height={size.height}
                  mapBrightness={GLOBE_CONFIG.mapBrightness}
                  mapSamples={GLOBE_CONFIG.mapSamples}
                  markerColor={GLOBE_CONFIG.markerColor}
                  onRender={handleRender}
                  phi={phiRef.current}
                  theta={GLOBE_CONFIG.theta}
                  width={size.width}
                />
              </div>
            </div>
          </div>
        </AnimatedGroup>
      </div>
    </section>
  );
}
