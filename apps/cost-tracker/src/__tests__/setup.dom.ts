import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ships no `window.matchMedia`. Components that read the viewport
// (`useIsMobile`, the sidebar, the project dialog) call it during mount, so the
// stub belongs here rather than in the files that remembered to add one.
//
// `.tsx` suites may opt into the node environment (`@vitest-environment node`)
// and still share this setup file, so the stub is guarded.
const matchMediaStub = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }) satisfies Partial<MediaQueryList>;

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = matchMediaStub as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});
