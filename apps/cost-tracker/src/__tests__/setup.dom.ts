// jsdom ships no `window.matchMedia`. Components that read the viewport
// (`useIsMobile`, the sidebar, the project dialog) call it during mount, so
// every jsdom test needs it — a per-file stub only covers the files that
// remember to add one.
const matchMediaStub = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }) satisfies Partial<MediaQueryList>;

if (!window.matchMedia) {
  window.matchMedia = matchMediaStub as unknown as typeof window.matchMedia;
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
