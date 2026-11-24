import type { Page } from "@playwright/test";

/**
 * Open a DatePicker trigger and choose one ISO day. Scope to this picker's
 * popover: a closed picker can stay mounted during its exit animation, so a
 * page-wide day selector would match two calendars.
 */
export async function pickDate(
  page: Page,
  triggerTestId: string,
  isoDate: string,
) {
  await page.getByTestId(triggerTestId).click();
  const popover = page.getByTestId(`${triggerTestId}-popover`);
  const day = popover.getByTestId(`calendar-day-${isoDate}`);
  for (let step = 0; step < 24; step += 1) {
    if (await day.count()) return day.click();
    await popover.getByTestId("calendar-next").click();
  }
  await day.click();
}
