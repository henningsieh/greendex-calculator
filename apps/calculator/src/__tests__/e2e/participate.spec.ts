import { expect, test, type Page } from "@playwright/test";

import { TestProjectFixture } from "./fixtures/test-project";

/**
 * End-to-End Test for Participant Questionnaire Form
 *
 * This test suite validates the complete questionnaire flow including:
 * - Form navigation and validation
 * - Valid and invalid input handling
 * - Conditional step logic (car questions)
 * - Progress tracking
 * - Final emissions calculation and console output
 *
 * Text-free policy: no assertion searches visible copy. Step position is
 * proven through the `data-step` counter on the question card, the impact
 * modal through its `data-testid`, and emissions through numeric
 * `data-co2-kg` / `data-value` attributes.
 */

// Regular expressions for button matching
const BUTTON_REGEX = {
  start: /start/i,
  continue: /continue/i,
  back: /back/i,
  complete: /complete/i,
} as const;

const COUNTRY_REGEX = {
  germany: /germany/i,
  austria: /austria/i,
  belgium: /belgium/i,
  denmark: /denmark/i,
  france: /france/i,
  italy: /italy/i,
  netherlands: /netherlands/i,
  portugal: /portugal/i,
  spain: /spain/i,
  sweden: /sweden/i,
} as const;

const OPTION_REGEX = {
  greenEnergy: /green energy/i,
  green: /green/i,
  conventional: /conventional/i,
  electric: /electric/i,
} as const;

// Questionnaire step indices (mirrors QUESTIONNAIRE_STEPS in
// @greendex/config/participate). Asserted as counters, never as copy.
const STEP = {
  participantInfo: 1,
  days: 2,
  accommodationCategory: 3,
  roomOccupancy: 4,
  electricity: 5,
  food: 6,
  flightKm: 7,
  boatKm: 8,
  trainKm: 9,
  busKm: 10,
  carKm: 11,
  carType: 12,
  carPassengers: 13,
  age: 14,
  gender: 15,
} as const;

async function expectStep(page: Page, step: number) {
  await expect(page.getByTestId("participate-step")).toHaveAttribute(
    "data-step",
    String(step),
  );
}

async function dismissImpactModal(page: Page) {
  const modal = page.getByTestId("impact-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: BUTTON_REGEX.continue }).click();
  await expect(modal).toBeHidden();
}

let fixture: TestProjectFixture;
let projectId: string;

test.describe("Questionnaire Form E2E Tests", () => {
  test.beforeAll(async () => {
    // Create test project in database
    fixture = new TestProjectFixture();
    projectId = await fixture.setup();
    console.log(`✅ Created test project with ID: ${projectId}`);
  });

  test.afterAll(async () => {
    // Clean up test data
    await fixture.teardown();
    console.log("✅ Cleaned up test project");
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to the test project participation page
    await page.goto(`/en/project/${projectId}/participate`);

    // Wait for the form to be visible (role-based start action)
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.start }),
    ).toBeVisible();
  });

  test("should complete full questionnaire with valid inputs", async ({
    page,
  }) => {
    // Step 0: Welcome - Click start
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Step 1: Participant Info
    await expectStep(page, STEP.participantInfo);
    await page.locator('input[id="firstName"]').fill("John");

    // Fill country - using CountrySelect component
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.germany }).click();

    await page.locator('input[id="email"]').fill("john.doe@example.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 2: Days
    await expectStep(page, STEP.days);
    let numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("7", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 3: Accommodation Category
    await expectStep(page, STEP.accommodationCategory);
    await page.getByRole("button", { name: "Hostel" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 4: Room Occupancy
    await expectStep(page, STEP.roomOccupancy);
    await page.getByRole("button", { name: "2 people" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 5: Electricity - should show impact modal
    await expectStep(page, STEP.electricity);
    await page.getByRole("button", { name: OPTION_REGEX.greenEnergy }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Wait for and close impact modal
    await dismissImpactModal(page);

    // Step 6: Food - should show impact modal
    await expectStep(page, STEP.food);
    await page.getByRole("button", { name: "sometimes" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Wait for and close impact modal
    await dismissImpactModal(page);

    // Step 7: Flight km - should show impact modal if > 0
    await expectStep(page, STEP.flightKm);
    numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("500", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Wait for and close impact modal
    await dismissImpactModal(page);

    // Step 8: Boat km - entering 0 should NOT show impact
    await expectStep(page, STEP.boatKm);
    numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 9: Train km - should show impact modal if > 0
    await expectStep(page, STEP.trainKm);
    numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("100", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Wait for and close impact modal
    await dismissImpactModal(page);

    // Step 10: Bus km - entering 0 should NOT show impact
    await expectStep(page, STEP.busKm);
    numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    // Wait for next step content to be visible
    await expectStep(page, STEP.carKm);

    // Step 11: Car km - test with value > 0 to trigger conditional steps
    numberInput = page.locator('input[type="number"]').first();
    await numberInput.click();
    await numberInput.pressSequentially("200", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 12: Car Type (conditional - only shown if carKm > 0) - Select Electric
    await expectStep(page, STEP.carType);
    // Wait for the electric button to be stable/clickable
    await expect(
      page.getByRole("button", { name: OPTION_REGEX.electric }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: OPTION_REGEX.electric }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 13: Car Passengers (conditional) - should show impact modal
    await expectStep(page, STEP.carPassengers);
    const carPassengersInput = page.locator('input[type="number"]').first();
    await carPassengersInput.click();
    await carPassengersInput.clear();
    await carPassengersInput.pressSequentially("3", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 5000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Wait for and close impact modal
    await dismissImpactModal(page);

    // Step 14: Age
    await expectStep(page, STEP.age);
    const ageInput = page.locator('input[type="number"]').first();
    await ageInput.click();
    await ageInput.clear();
    await ageInput.pressSequentially("28", { delay: 50 });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Step 15: Gender - Final step
    await expectStep(page, STEP.gender);

    // Select gender to enable Complete button
    await page.getByRole("button", { name: "Male", exact: true }).click();

    const completeBtn = page.getByRole("button", {
      name: BUTTON_REGEX.complete,
    });
    await expect(completeBtn).toBeEnabled({ timeout: 5000 });
    await completeBtn.click();

    // Verify final results are displayed with emissions breakdown
    await expect(page.getByTestId("summary-panel")).toBeVisible({
      timeout: 5000,
    });

    // Verify the summary shows participant and project-shared travel separately
    // through numeric emission attributes (reword-proof).
    for (const testId of [
      "summary-participant-travel",
      "summary-accommodation",
      "summary-food",
      "summary-total",
    ]) {
      await expect(page.getByTestId(testId)).toHaveAttribute(
        "data-co2-kg",
        /^\d+\.\d+$/,
      );
    }
  });

  test("should handle conditional car question skip when carKm is 0", async ({
    page,
  }) => {
    // Start questionnaire
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Fill participant info
    await page.locator('input[id="firstName"]').fill("Jane");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.france }).click();
    await page.locator('input[id="email"]').fill("jane@example.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Days
    await page.locator('input[type="number"]').first().fill("5");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Accommodation
    await page.getByRole("button", { name: "Camping" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Room Occupancy
    await page.getByRole("button", { name: "4+ people" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Electricity
    await page.getByRole("button", { name: OPTION_REGEX.conventional }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    // Food
    await page.getByRole("button", { name: "never" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    // Flight - 0 km
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Boat - 0 km
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Train - 0 km
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Bus - 0 km
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Car - 0 km (should skip car type and passengers)
    await expectStep(page, STEP.carKm);
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Should skip to Age (not car type/passengers): the step counter lands
    // on age, and no impact modal appears for the skipped car steps.
    await expectStep(page, STEP.age);

    // Verify car type question is NOT shown
    await expect(page.getByTestId("impact-modal")).toHaveCount(0);
  });

  test("should validate required fields and prevent progression with invalid input", async ({
    page,
  }) => {
    // Start questionnaire
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Step 1: Try to continue without filling required fields
    const continueButton = page.getByRole("button", {
      name: BUTTON_REGEX.continue,
    });

    // Continue button should be disabled without firstName
    await expect(continueButton).toBeDisabled();

    // Fill firstName only
    await page.locator('input[id="firstName"]').fill("Test");
    await expect(continueButton).toBeDisabled();

    // Fill country
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.spain }).click();
    await expect(continueButton).toBeDisabled();

    // Fill email to enable button
    await page.locator('input[id="email"]').fill("test@example.com");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 2: Days - test invalid/zero value
    await page.locator('input[type="number"]').first().fill("0");
    await expect(continueButton).toBeDisabled();

    // Negative value should also disable
    await page.locator('input[type="number"]').first().fill("-5");
    await expect(continueButton).toBeDisabled();

    // Valid positive value
    await page.locator('input[type="number"]').first().fill("3");
    await expect(continueButton).toBeEnabled();
  });

  test("should validate email format", async ({ page }) => {
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    await page.locator('input[id="firstName"]').fill("Test");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.italy }).click();

    // Try invalid email formats
    const emailInput = page.locator('input[id="email"]');
    const continueButton = page.getByRole("button", {
      name: BUTTON_REGEX.continue,
    });

    // Invalid email without @
    await emailInput.fill("invalidemail");
    // HTML5 validation should prevent enabling
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) =>
      el.validity ? !el.validity.valid : false,
    );
    expect(isInvalid).toBe(true);

    // Valid email
    await emailInput.fill("valid@email.com");
    await expect(continueButton).toBeEnabled();
  });

  test("should validate number input ranges", async ({ page }) => {
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Fill participant info quickly
    await page.locator('input[id="firstName"]').fill("Test");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.portugal }).click();
    await page.locator('input[id="email"]').fill("test@test.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Days - should not accept negative
    const numberInput = page.locator('input[type="number"]').first();
    const continueButton = page.getByRole("button", {
      name: BUTTON_REGEX.continue,
    });

    await numberInput.fill("-10");
    await expect(continueButton).toBeDisabled();

    await numberInput.fill("0");
    await expect(continueButton).toBeDisabled();

    await numberInput.fill("1");
    await expect(continueButton).toBeEnabled();

    // Very large number should still work
    await numberInput.fill("365");
    await expect(continueButton).toBeEnabled();
  });

  test("should show progress bar and step counter", async ({ page }) => {
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Check initial step counter (should show step 2 of 16)
    const counter = page.getByTestId("step-counter");
    await expect(counter).toHaveAttribute("data-current", "2");
    await expect(counter).toHaveAttribute("data-total", "16");

    // Fill and continue
    await page.locator('input[id="firstName"]').fill("Test");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.germany }).click();
    await page.locator('input[id="email"]').fill("test@example.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Should show step 3 of 16
    await expect(counter).toHaveAttribute("data-current", "3");

    // Progress bar should exist
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
  });

  test("should allow back navigation", async ({ page }) => {
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Fill participant info
    await page.locator('input[id="firstName"]').fill("BackTest");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.belgium }).click();
    await page.locator('input[id="email"]').fill("back@test.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Days step
    await page.locator('input[type="number"]').first().fill("7");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Now at accommodation step - verify we can go back
    await expectStep(page, STEP.accommodationCategory);

    // Click back button
    await page.getByRole("button", { name: BUTTON_REGEX.back }).click();

    // Should be back at days step
    await expectStep(page, STEP.days);

    // Value should be preserved
    const daysInput = page.locator('input[type="number"]').first();
    await expect(daysInput).toHaveValue("7");
  });

  test("should display CO2 stats from step 2 onwards", async ({ page }) => {
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Step 1 - stats should not be visible yet
    await expect(page.getByTestId("stat-co2")).toHaveCount(0);

    // Fill participant info and continue
    await page.locator('input[id="firstName"]').fill("Stats");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.netherlands }).click();
    await page.locator('input[id="email"]').fill("stats@test.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Fill days
    await page.locator('input[type="number"]').first().fill("5");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Now at step 2+ - stats cards render with computed values (reword-proof attributes).
    await expect(page.locator('[data-testid="stat-co2"]')).toHaveAttribute(
      "data-value",
      "0.0",
    );
    await expect(page.locator('[data-testid="stat-trees"]')).toBeVisible();
    // Should show 0.0 kg initially (numeric attribute, no copy search)
    await expect(page.getByTestId("stat-co2")).toBeVisible();
  });

  test("should handle car passengers validation", async ({ page }) => {
    // Navigate through to car passengers step
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    // Quick fill to get to car steps
    await page.locator('input[id="firstName"]').fill("CarTest");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.sweden }).click();
    await page.locator('input[id="email"]').fill("car@test.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Days
    const daysInput1 = page.locator('input[type="number"]').first();
    await daysInput1.click();
    await daysInput1.pressSequentially("3", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Skip through accommodation/food quickly
    await page.getByRole("button", { name: "Camping" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.getByRole("button", { name: "alone" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.getByRole("button", { name: OPTION_REGEX.green }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    await page.getByRole("button", { name: "never" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    // Skip transport to car
    let transportInput = page.locator('input[type="number"]').first();
    await transportInput.click();
    await transportInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 2000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // flight

    transportInput = page.locator('input[type="number"]').first();
    await transportInput.click();
    await transportInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 2000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // boat

    transportInput = page.locator('input[type="number"]').first();
    await transportInput.click();
    await transportInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 2000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // train

    transportInput = page.locator('input[type="number"]').first();
    await transportInput.click();
    await transportInput.pressSequentially("0", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 2000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // bus

    // Car km > 0 to trigger conditional steps
    transportInput = page.locator('input[type="number"]').first();
    await transportInput.click();
    await transportInput.pressSequentially("150", { delay: 50 });
    await expect(
      page.getByRole("button", { name: BUTTON_REGEX.continue }),
    ).toBeEnabled({
      timeout: 3000,
    });
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Car type (no impact modal for carKm, modal only appears after carPassengers)
    await expectStep(page, STEP.carType);
    const electricBtn = page.getByRole("button", {
      name: OPTION_REGEX.electric,
    });
    await expect(electricBtn).toBeVisible({ timeout: 3000 });
    await electricBtn.click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Car passengers - validate minimum of 1
    const passengersInput = page.locator('input[type="number"]').first();
    const continueButton = page.getByRole("button", {
      name: BUTTON_REGEX.continue,
    });

    // 1 or more should enable
    await passengersInput.click();
    await passengersInput.clear();
    await passengersInput.pressSequentially("1", { delay: 50 });
    await expect(continueButton).toBeEnabled({ timeout: 3000 });

    await passengersInput.click();
    await passengersInput.clear();
    await passengersInput.pressSequentially("5", { delay: 50 });
    await expect(continueButton).toBeEnabled({ timeout: 3000 });
  });

  test("should display final summary with breakdown", async ({ page }) => {
    // Complete full questionnaire with known values
    await page.getByRole("button", { name: BUTTON_REGEX.start }).click();

    await page.locator('input[id="firstName"]').fill("Summary");
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: COUNTRY_REGEX.denmark }).click();
    await page.locator('input[id="email"]').fill("summary@test.com");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.locator('input[type="number"]').first().fill("7");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.getByRole("button", { name: "Hostel" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.getByRole("button", { name: "2 people" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    await page.getByRole("button", { name: OPTION_REGEX.green }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    await page.getByRole("button", { name: "sometimes" }).click();
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    // Add some transport
    await page.locator('input[type="number"]').first().fill("100");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();
    await dismissImpactModal(page);

    // Skip rest of transport
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // boat
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // train
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // bus
    await page.locator('input[type="number"]').first().fill("0");
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click(); // car

    // Age - final step before gender
    const ageInput = page.locator('input[type="number"]').first();
    await ageInput.click();
    await ageInput.clear();
    await ageInput.pressSequentially("30", { delay: 50 });

    // Click continue to proceed to gender step
    await page.getByRole("button", { name: BUTTON_REGEX.continue }).click();

    // Gender step - select gender
    await expectStep(page, STEP.gender);
    await page.getByRole("button", { name: "Male", exact: true }).click();

    // Now expect and click the complete button to submit and show summary
    const completeBtn = page.getByRole("button", {
      name: BUTTON_REGEX.complete,
    });
    await expect(completeBtn).toBeEnabled({ timeout: 5000 });
    await completeBtn.click();

    // Should show breakdown labels, including the public Project Shared Travel
    // contribution seeded by the unauthenticated fixture.
    await expect(page.getByTestId("summary-participant-travel")).toBeVisible();
    // Text-free: shared-travel metric with exact computed value (reword-proof attribute).
    await expect(
      page.locator('[data-testid="shared-travel-metric"]'),
    ).toHaveAttribute("data-co2-kg", "5.3");

    // Should show CO2 values as numeric attributes (no copy search).
    const co2Values = await page
      .getByTestId("summary-panel")
      .locator("[data-co2-kg]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-co2-kg")));
    expect(co2Values.length).toBeGreaterThan(0);
    for (const value of co2Values) {
      expect(value).toMatch(/^\d+\.\d+$/);
    }
  });
});
