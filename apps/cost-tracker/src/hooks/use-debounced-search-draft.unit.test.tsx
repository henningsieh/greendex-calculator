import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedSearchDraft } from "@/hooks/use-debounced-search-draft";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(initialSearch = "") {
  const push = vi.fn();
  const hook = renderHook(
    ({ pushFn, urlSearch }: { pushFn: typeof push; urlSearch: string }) =>
      useDebouncedSearchDraft({ push: pushFn, urlSearch }),
    { initialProps: { pushFn: push, urlSearch: initialSearch } },
  );
  return { push, ...hook };
}

describe("useDebouncedSearchDraft", () => {
  it("pushes only the latest draft after the debounce interval", () => {
    const { push, result } = setup("old");

    act(() => result.current.onChange("a"));
    act(() => result.current.onChange("ab"));
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(push).not.toHaveBeenCalled();
    expect(result.current.draft).toBe("ab");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("ab");
  });

  it("cancels a pending write when the URL search changes externally", () => {
    const { push, rerender, result } = setup("old");

    act(() => result.current.onChange("newest"));
    // Clear filters or browser navigation replaces the URL before the timer.
    rerender({ pushFn: push, urlSearch: "" });

    expect(result.current.draft).toBe("");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps newer typing when the previous local push is acknowledged", () => {
    const { push, rerender, result } = setup("");

    act(() => result.current.onChange("a"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenLastCalledWith("a");

    act(() => result.current.onChange("ab"));
    // The URL catches up with the first push while "ab" is still pending.
    rerender({ pushFn: push, urlSearch: "a" });

    expect(result.current.draft).toBe("ab");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith("ab");
  });

  it("uses the latest push callback when filters change during the debounce", () => {
    const firstPush = vi.fn();
    const secondPush = vi.fn();
    const { rerender, result } = renderHook(
      ({ pushFn }: { pushFn: typeof firstPush }) =>
        useDebouncedSearchDraft({ push: pushFn, urlSearch: "" }),
      { initialProps: { pushFn: firstPush } },
    );

    act(() => result.current.onChange("a"));
    rerender({ pushFn: secondPush });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(firstPush).not.toHaveBeenCalled();
    expect(secondPush).toHaveBeenCalledWith("a");
  });
});
