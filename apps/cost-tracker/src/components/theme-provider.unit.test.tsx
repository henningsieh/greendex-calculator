import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providerProps: undefined as Record<string, unknown> | undefined,
  resolvedTheme: "theme-erasmus-light" as string | undefined,
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: (props: { children: ReactNode } & Record<string, unknown>) => {
    mocks.providerProps = props;
    return <>{props.children}</>;
  },
  useTheme: () => ({
    resolvedTheme: mocks.resolvedTheme,
    setTheme: mocks.setTheme,
  }),
}));

const { ThemeProvider } = await import("@/components/theme-provider");

function pressD(target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", bubbles: true }),
    );
  });
}

beforeEach(() => {
  mocks.setTheme.mockReset();
  mocks.resolvedTheme = "theme-erasmus-light";
});

describe("Theme provider", () => {
  it("maps the explicitly chosen light theme to its own class", () => {
    render(<ThemeProvider>{null}</ThemeProvider>);

    expect(mocks.providerProps?.value).toMatchObject({
      light: "theme-erasmus-light",
      "theme-erasmus-light": "theme-erasmus-light",
    });
    expect(mocks.providerProps?.attribute).toBe("class");
  });

  it("toggles from the explicit light theme to dark", () => {
    render(<ThemeProvider>{null}</ThemeProvider>);

    pressD();

    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles from dark back to light", () => {
    mocks.resolvedTheme = "theme-erasmus-dark";
    render(<ThemeProvider>{null}</ThemeProvider>);

    pressD();

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
  });

  it("ignores the hotkey while typing", () => {
    const { container } = render(
      <ThemeProvider>
        <input />
      </ThemeProvider>,
    );

    pressD(container.querySelector("input")!);

    expect(mocks.setTheme).not.toHaveBeenCalled();
  });

  it("ignores the hotkey with a modifier held", () => {
    render(<ThemeProvider>{null}</ThemeProvider>);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "d", ctrlKey: true }),
      );
    });

    expect(mocks.setTheme).not.toHaveBeenCalled();
  });
});
