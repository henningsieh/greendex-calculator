import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// With `isolate: false`, module state and mocks survive a file boundary.
// Clearing the registry after each file gives the next file a fresh module
// graph without spawning a new process per file.
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});
