"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { themes, type ThemeKey } from "@/lib/themes";
import { cn } from "@/lib/utils";

export interface ThemeSwitcherProps {
  value?: ThemeKey;
  onChange?: (theme: ThemeKey) => void;
  defaultValue?: ThemeKey;
  className?: string;
}

interface Rect {
  x: number;
  width: number;
  height: number;
}

export const ThemeSwitcher = ({
  value,
  onChange,
  defaultValue = "system",
  className,
}: ThemeSwitcherProps) => {
  const t = useTranslations("app.appearance.themes");
  const { theme, setTheme } = useTheme();

  // Hydration-safe mount flag
  const hydrated = useHydrated();

  // Refs for DOM measurements
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Refs for rect tracking (avoids useState re-renders)
  const hoverRectRef = useRef<Rect>({ x: 0, width: 0, height: 0 });
  const hoverInitializedRef = useRef(false);

  // Motion value refs for imperative updates
  const activeMotionRef = useRef<HTMLDivElement>(null);
  const hoverMotionRef = useRef<HTMLDivElement>(null);

  // Determine current theme (controlled vs uncontrolled)
  const currentTheme = value ?? theme;

  // Memoize active index
  const activeIndex = useMemo(
    () => themes.findIndex((t) => t.key === currentTheme),
    [currentTheme],
  );

  // Stable theme click handler
  const handleThemeClick = useCallback(
    (themeKey: ThemeKey) => {
      if (onChange) {
        onChange(themeKey);
      } else {
        setTheme(themeKey);
      }
    },
    [onChange, setTheme],
  );

  // Utility to compute rect for an index relative to container
  const computeRectForIndex = useCallback((index: number): Rect => {
    const container = containerRef.current;
    const btn = buttonRefs.current[index];

    if (!container || !btn || index === -1) {
      return { x: 0, width: 0, height: 0 };
    }

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    return {
      x: Math.round(btnRect.left - containerRect.left),
      width: Math.round(btnRect.width),
      height: Math.round(btnRect.height),
    };
  }, []);

  // Update active overlay position (imperative, no re-render)
  const updateActiveRect = useCallback(() => {
    if (!hydrated || activeIndex === -1) return;

    const newRect = computeRectForIndex(activeIndex);

    // Imperatively update motion div
    const motionDiv = activeMotionRef.current;
    if (motionDiv) {
      motionDiv.style.width = `calc(${newRect.width}px - 2px)`;
      motionDiv.style.height = `calc(${newRect.height}px - 2px)`;
      motionDiv.style.transform = `translateX(${newRect.x + 1}px) translateY(1px)`;
    }
  }, [activeIndex, computeRectForIndex, hydrated]);

  // Update hover overlay position (imperative, no re-render)
  const updateHoverRect = useCallback(
    (index: number, visible: boolean, instant = false) => {
      if (!hydrated) return;

      const newRect = visible ? computeRectForIndex(index) : hoverRectRef.current;
      hoverRectRef.current = newRect;

      const motionDiv = hoverMotionRef.current;
      if (motionDiv) {
        motionDiv.style.width = `calc(${newRect.width}px - 2px)`;
        motionDiv.style.height = `calc(${newRect.height}px - 2px)`;
        motionDiv.style.opacity = visible ? "1" : "0";

        if (instant) {
          motionDiv.style.transition = "opacity 0.12s";
          motionDiv.style.transform = `translateX(${newRect.x + 1}px) translateY(1px)`;
        } else {
          motionDiv.style.transition =
            "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.12s";
          motionDiv.style.transform = `translateX(${newRect.x + 1}px) translateY(1px)`;
        }
      }
    },
    [computeRectForIndex, hydrated],
  );

  // Stable event handlers
  const handlePointerEnter = useCallback(
    (index: number) => {
      const instant = !hoverInitializedRef.current;
      updateHoverRect(index, true, instant);
      if (!hoverInitializedRef.current) {
        hoverInitializedRef.current = true;
      }
    },
    [updateHoverRect],
  );

  const handlePointerLeave = useCallback(() => {
    updateHoverRect(-1, false);
  }, [updateHoverRect]);

  const handleContainerMouseLeave = useCallback(() => {
    updateHoverRect(-1, false);
    hoverInitializedRef.current = false;
  }, [updateHoverRect]);

  // Set default theme once hydrated
  useEffect(() => {
    if (defaultValue && !theme && hydrated) {
      setTheme(defaultValue);
    }
  }, [defaultValue, theme, setTheme, hydrated]);

  // Update active overlay on theme change or resize
  useLayoutEffect(() => {
    if (!hydrated) return;

    updateActiveRect();

    let ro: ResizeObserver | null = null;
    const container = containerRef.current;

    if (container && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateActiveRect);
      ro.observe(container);
    }

    window.addEventListener("resize", updateActiveRect);

    return () => {
      window.removeEventListener("resize", updateActiveRect);
      ro?.disconnect();
    };
  }, [updateActiveRect, hydrated]);

  // Don't render until hydrated (hydration safety)
  if (!hydrated) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onMouseLeave={handleContainerMouseLeave}
      className={cn(
        "relative isolate flex h-8 rounded-full bg-transparent p-1 ring-1 ring-border",
        className,
      )}
    >
      {/* Active overlay - using regular div with ref for imperative updates */}
      <div
        ref={activeMotionRef}
        className="ease-spring pointer-events-none absolute left-0 rounded-full bg-accent transition-transform duration-280"
        style={{
          top: "calc(50% - 11.5px)",
        }}
      />

      {/* Hover overlay - improved color for better visibility */}
      <div
        ref={hoverMotionRef}
        className="pointer-events-none absolute left-0 rounded-full bg-primary/40 transition-opacity duration-120"
        style={{
          top: "calc(50% - 11.5px)",
          opacity: 0,
        }}
      />

      {themes.map(({ key, icon: Icon }, index) => {
        const isActive = currentTheme === key;

        return (
          <button
            aria-label={t(key)}
            title={t(key)}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            className={cn(
              "relative size-6 rounded-full transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            key={key}
            aria-pressed={isActive}
            onClick={() => handleThemeClick(key)}
            onMouseEnter={() => handlePointerEnter(index)}
            onMouseLeave={handlePointerLeave}
            onFocus={() => handlePointerEnter(index)}
            onBlur={handlePointerLeave}
            type="button"
          >
            <Icon
              className={cn(
                "relative m-auto size-4 transition-colors",
                isActive ? "text-accent-foreground" : "text-muted-foreground",
              )}
              strokeWidth="2.6"
            />
          </button>
        );
      })}
    </div>
  );
};
