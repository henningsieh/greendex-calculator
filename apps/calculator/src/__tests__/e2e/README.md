# End-to-End Tests

This directory contains Playwright-based end-to-end tests for the Greendex Calculator application.

## Location

E2E tests are located at `src/__tests__/e2e/` following the colocated testing pattern where tests live close to the source code they test.

## Prerequisites

The operator supplies existing apps on configured loopback origins, the shared
development database and the Calculator socket service. Dev and production
servers are accepted without an attestation flag. These checks do not establish
production provenance; the user supplies reviewed builds for final production
verification. The runner does not build, start servers, migrate or seed.

## Running E2E Tests

From the repository root, use `pnpm run test:e2e`. Both ordinary suites and the
cross-app merge suite run serially with one worker and zero retries. Missing
servers or credentials fail. For a focused Calculator spec use
`pnpm --dir apps/calculator exec playwright test --config=playwright.config.ts <file> --workers=1 --retries=0`
with the same prerequisites and loaded environment.

## Test Structure

### Output Directories

- **`fixtures/test-project.ts`**: Database fixture for creating a test project with organization and activities.
- **`.playwright/report/`**: HTML test reports (generated after test runs)
- **`.playwright/results/`**: Test execution artifacts (screenshots, videos, traces)

### Global Setup

- **`global-setup.ts`**: Validates that the dev server is running before tests execute.

### Test Suites

- **`questionnaire.spec.ts`**: Comprehensive tests for the participant questionnaire form, including:
  - Valid input flow (complete questionnaire)
  - Invalid input validation
  - Conditional step logic (car questions skip)
  - Progress tracking
  - Back navigation
  - Final emissions calculation and console output

## Test Coverage

The questionnaire e2e tests validate:

- ✅ Form field validation (required fields, email format, number ranges)
- ✅ Multi-step navigation (forward/backward)
- ✅ Conditional logic (car questions skip when carKm = 0)
- ✅ Progress bar and step counter
- ✅ Impact modals after emission-affecting steps
- ✅ CO2 stats display from step 2 onwards
- ✅ Final summary with breakdown (Participant Travel, accommodation, food, Project Shared Travel)
- ✅ Console logging of complete questionnaire data

## Notes

- Tests automatically create and clean up test data in the database
- Each test run creates a new project with a unique ID
- The Playwright config is set to reuse existing dev server if available
- Screenshots are captured only on test failures
- Traces are captured on first retry for debugging
