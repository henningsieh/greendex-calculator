import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { DatePicker } from "@/components/date-picker";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) satisfies Partial<MediaQueryList>,
  );
});

describe("DatePicker", () => {
  it("emits a stored UTC midnight for a calendar day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        data-testid="date-picker"
        onChange={onChange}
        value={new Date("2027-04-03T00:00:00.000Z")}
      />,
    );

    await user.click(screen.getByTestId("date-picker"));
    await user.click(screen.getByTestId("calendar-day-2027-04-05"));

    expect(onChange).toHaveBeenCalledWith(new Date("2027-04-05T00:00:00.000Z"));
  });

  it("clears an optional value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        clearable
        data-testid="date-picker"
        onChange={onChange}
        value={new Date("2027-04-03T00:00:00.000Z")}
      />,
    );

    await user.click(screen.getByTestId("date-picker"));
    await user.click(screen.getByTestId("date-picker-clear"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
