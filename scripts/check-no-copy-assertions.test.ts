import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const file = "apps/example/src/copy.test.tsx";

function runChecker(source: string) {
  const fixture = mkdtempSync(join(tmpdir(), "no-copy-assertions-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "apps/example/src"), { recursive: true });
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    copyFileSync(
      join(root, "scripts/check-no-copy-assertions.ts"),
      join(fixture, "scripts/check-no-copy-assertions.ts"),
    );
    writeFileSync(join(fixture, file), source);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/check-no-copy-assertions.ts"],
      { cwd: fixture, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function expectViolations(source: string, lines = source.split("\n")) {
  const result = runChecker(source);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(
    `check:no-copy-assertions FAILED — ${lines.length} visible-copy matcher occurrence(s) in test sources:\n` +
      lines
        .map(
          (line) =>
            `  ${file}:${source.split("\n").indexOf(line) + 1}: ${line.trim().slice(0, 120)}`,
        )
        .join("\n") +
      `\n\nReplace with text-free hooks: [data-testid="..."], design-system\n` +
      `variant/state attributes, structure (roles/counts), URLs, or\n` +
      `enabled/disabled and persistence state. See the test policy.\n`,
  );
}

describe("visible-copy assertion checker", () => {
  it.each([
    [
      "role-name literal",
      'page.getByRole("heading", { name: "This page could not be found." });',
    ],
    ["regex-name literal", 'screen.getByRole("option", { name: /Germany/ });'],
    ["title literal", 'expect(page).toHaveTitle("Dashboard");'],
  ])("rejects a %s", (_name, source) => {
    expectViolations(source);
  });

  it("covers role query variants, direct copy queries, and multiline options", () => {
    const source = [
      'getByRole("button", { name: /start/i });',
      'screen.findByRole("button", { name: "Save" });',
      'queryByRole("button", { "name": /cancel/i });',
      'screen.queryByRole("button", { name: "Cancel" });',
      'page.findByRole("heading", { name: /Welcome/ });',
      'getByLabel("Email");',
      "screen.findByLabel(/Password/i);",
      'page.getByPlaceholder("Search");',
      "screen.getByTitle(/Details/);",
      "expect(page).toHaveTitle(/Dashboard/);",
      'page.getByAltText("Logo");',
      "page.getByRole(",
      '  "button",',
      '  { exact: true, name: "Continue" },',
      ");",
    ].join("\n");
    expectViolations(
      source,
      source.split("\n").filter((line, index) => index <= 11),
    );
  });

  it("checks literal copy options on query calls", () => {
    expectViolations(
      [
        'page.getByRole("button", { title: "Help" });',
        'page.getByRole("textbox", { placeholder: /Search/ });',
        'screen.findByRole("textbox", { labelText: "Email" });',
        'screen.queryByRole("img", { altText: /Logo/i });',
        'page.getByRole("heading", {',
        '  name: "Welcome",',
        "});",
      ].join("\n"),
      [
        'page.getByRole("button", { title: "Help" });',
        'page.getByRole("textbox", { placeholder: /Search/ });',
        'screen.findByRole("textbox", { labelText: "Email" });',
        'screen.queryByRole("img", { altText: /Logo/i });',
        'page.getByRole("heading", {',
      ],
    );
  });

  it("rejects Text-suffixed copy queries with literals", () => {
    expectViolations(
      [
        'screen.getByLabelText("Email address");',
        "screen.findByPlaceholderText(/Search/);",
        'screen.getByDisplayValue("Cost Tracker E2E");',
        "screen.queryByDisplayValue(/Dashboard/);",
      ].join("\n"),
    );
  });

  it("allows identifiers and test ids in Text-suffixed queries", () => {
    const source = [
      "screen.getByLabelText(label);",
      "screen.findByPlaceholderText(placeholder);",
      'screen.getByTestId("email");',
    ].join("\n");
    expect(runChecker(source)).toEqual({
      status: 0,
      stdout:
        "check:no-copy-assertions passed — no visible-copy matchers in test sources.\n",
      stderr: "",
    });
  });

  it("allows identifiers, member expressions, catalogue reads, and nameless roles", () => {
    const source = [
      'page.getByRole("button", { name: projectName });',
      'screen.findByRole("heading", { name: project.name });',
      'queryByRole("option", { name: messages.countries.germany });',
      'page.getByRole("button");',
      'page.getByRole("button", { exact: true });',
      "screen.getByLabel(label);",
      "screen.findByLabel(messages.email);",
      "page.getByPlaceholder(placeholder);",
      "screen.getByTitle(project.title);",
      "expect(page).toHaveTitle(title);",
      "page.getByAltText(messages.logo);",
      '// page.getByRole("button", { name: "Comment only" });',
      'const example = `page.getByRole("button", { name: "Not a query" })`;',
    ].join("\n");
    expect(runChecker(source)).toEqual({
      status: 0,
      stdout:
        "check:no-copy-assertions passed — no visible-copy matchers in test sources.\n",
      stderr: "",
    });
  });

  it("preserves every existing text matcher and one diagnostic per line", () => {
    expectViolations(
      [
        'screen.getByText("GreenDex");',
        "screen.findByText(copy);",
        "screen.queryByText(copy);",
        "expect(locator).toContainText(copy);",
        "expect(locator).toHaveTextContent(copy);",
        "expect(locator).toHaveText(copy);",
        "locator.textContent();",
        "locator.innerText();",
        'page.locator("div", { hasText: copy });',
        'page.locator("text=Welcome");',
        "page.locator('text=Welcome');",
        'page.locator("div >> (text=Welcome)");',
        'expect(screen.getByText("GreenDex")).toHaveText("GreenDex");',
      ].join("\n"),
    );
  });
});
