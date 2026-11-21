import { afterAll, vi } from "vitest";

// Node tests have no DOM to clean up, so they skip the Testing Library setup.
// With `isolate: false`, module state and mocks survive a file boundary.
// Clearing the registry after each file gives the next file a fresh module
// graph without spawning a new process per file.
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});
