#!/usr/bin/env node
/* Repository policy: tests assert functionality, states and processes —
 * never visible copy. Text-matching queries can only match rendered text,
 * so any occurrence inside a test file is a policy violation, no matter the
 * surrounding intent. Design or marketing rewording must never break tests.
 *
 * Scope (phase 2): browser test sources (e2e, merge suites, helpers)
 * plus unit/integration test sources across apps and packages.
 * All visible-copy matcher families are covered, not just getByText.
 * Enforcement: wired into `pnpm run lint`; fails CI-red with file:line list.
 */
import { globSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const patterns = [
  "apps/*/src/__tests__/e2e/**/*.{ts,tsx,js,jsx,mts,cts}",
  "apps/*/src/__tests__/merge/**/*.{ts,tsx,js,jsx,mts,cts}",
  "apps/*/test/e2e/**/*.{ts,tsx,js,jsx,mts,cts}",
  "apps/*/src/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts}",
  "packages/*/src/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts}",
];

const matchers = [
  "getByText",
  "findByText",
  "queryByText",
  "toContainText",
  "toHaveTextContent",
  "toHaveText",
  "textContent",
  "innerText",
  "hasText",
  '"text=',
  "'text=",
  "(text=",
];

const seen = new Set<string>();

const violations: string[] = [];
for (const pattern of patterns) {
  for (const file of globSync(pattern, {
    cwd: root,
    exclude: ["**/node_modules/**"],
  })) {
    const source = readFileSync(resolve(root, file), "utf8");
    source.split("\n").forEach((line, index) => {
      const stripped = line.replace(/^\s*(\/\/|\*)/, "");
      const hit = matchers.find((matcher) => stripped.includes(matcher));
      if (hit) {
        const key = `${file}:${index + 1}:${hit}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    `check:no-copy-assertions FAILED — ${violations.length} visible-copy matcher occurrence(s) in test sources:\n` +
      violations.map((v) => `  ${v}`).join("\n") +
      `\n\nReplace with text-free hooks: [data-testid="..."], design-system\n` +
      `variant/state attributes, structure (roles/counts), URLs, or\n` +
      `enabled/disabled and persistence state. See the test policy.`,
  );
  process.exit(1);
}
console.log("check:no-copy-assertions passed — no getByText in test sources.");
