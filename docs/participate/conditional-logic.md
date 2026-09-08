---
applyTo: '**'
description: Conditional logic and step flow in the questionnaire
---

# Conditional Logic & Step Flow

This file documents the questionnaire's conditional steps and how skip/undo/back navigation behaves depending on prior answers.

## Auto-Skip Logic
- If `carKm === 0`, then:
  - Steps 11 (Car Type) and 12 (Car Passengers) are skipped automatically.
  - The workflow jumps from Step 10 (Car km) to Step 13 (Age).

## Conditional Rendering & Validation
- When `carKm > 0`, the `carType` and `carPassengers` fields must be presented and validated.
- If `carKm === 0`, those fields should not be present and must remain undefined.

## Back Navigation with Conditionals
- On Back from Step 13:
  - If `carKm === 0`, navigate back to Step 10 (Car km).
  - If `carKm > 0`, navigate back to Step 12 (Car passengers) normally.

## Step Counter Adjustment
- The UI shows the step count accounting for skipped steps.
- Example: If 11–12 are skipped, Step 13 displays as "Step 11 of 15".

## Additional Notes
- Conditional questions must be excluded from validation and from the final payload if skipped.
- Consider a small animation/remount when skipping steps to keep client-side animated components consistent.
