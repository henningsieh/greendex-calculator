import { expect, it } from "vitest";

import { canonicalizeSource } from "./tailwind-canonical";

const canonicalClasses: Record<string, string> = {
  "rounded-[2px]": "rounded-xs",
  "w-[16px]": "w-4",
  "w-[64px]": "w-16",
  "p-[16px]": "p-4",
};

const designSystem = {
  canonicalizeCandidates: (classes: string[]) =>
    classes.map((value) => canonicalClasses[value] ?? value),
};

it("canonicalizes only string literals that produce class names", () => {
  const source = `export const view = (
  active: boolean,
  size: string,
  extra: string,
  value: string,
  theme: string,
) => (
  <div
    data-class="rounded-[2px]"
    className="rounded-[2px] price-$$"
    class="w-[64px]"
    title={cn(
      size === "w-[64px]" && "rounded-[2px]",
      format("p-[16px]"),
      "w-[16px]" === value && "block",
    )}
  >
    <span className={"flex " + extra} />
    <span className={classes["w-[64px]"]} />
    <span className={cn(resolveClass(theme, "w-[16px]"))} />
    <span className={cn("w-[64px]", active ? "rounded-[2px]" : "p-[16px]")} />
  </div>
);
`;

  expect(canonicalizeSource(source, designSystem)).toBe(`export const view = (
  active: boolean,
  size: string,
  extra: string,
  value: string,
  theme: string,
) => (
  <div
    data-class="rounded-[2px]"
    className="rounded-xs price-$$"
    class="w-16"
    title={cn(
      size === "w-[64px]" && "rounded-xs",
      format("p-[16px]"),
      "w-[16px]" === value && "block",
    )}
  >
    <span className={"flex " + extra} />
    <span className={classes["w-[64px]"]} />
    <span className={cn(resolveClass(theme, "w-[16px]"))} />
    <span className={cn("w-16", active ? "rounded-xs" : "p-4")} />
  </div>
);
`);
});

it("preserves JavaScript string escaping in rewritten literals", () => {
  const source = String.raw`export const view = () => <div className={cn('before:content-[\'x\'] w-[16px]')} />;`;

  expect(canonicalizeSource(source, designSystem)).toBe(
    String.raw`export const view = () => <div className={cn('before:content-[\'x\'] w-4')} />;`,
  );
});
