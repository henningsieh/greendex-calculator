---
applyTo: '**'
description: Unit tests and testing strategies for questionnaire calculations
---

# Questionnaire Testing & Unit Tests

This file covers how to test the participant questionnaire implementations and what to verify in unit and integration tests.

## Tests to Cover
- Transport emission factor calculations for each transport mode.
- Car emissions with passenger division.
- Electric vs conventional car handling.
- Accommodation emission calculations and room occupancy/electricity adjustments.
- Food emission calculations and edge cases (days=0, min values).
- Conditional skip logic (carKm=0) and validation skipping.
- Step counter and progress bar correct behavior when steps are skipped.

## Unit Tests
- Place tests under `src/components/participate/__tests__/`.
- Typical tests: compute CO₂ for sample payloads, verify tree counts, and check skip logic.

## Running Tests
Use the existing project test script:
```bash
npm run test:run
```

## Integration & Manual Verification
- Confirm the intermediate transport display appears after Step 10 for 3 seconds.
- Verify Final breakdown is correct in Step 14.
- Validate console output shows expected values (see `emissions-calculations.md` example).
