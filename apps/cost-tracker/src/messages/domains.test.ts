// @vitest-environment node

import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LANGUAGE_CODES } from "@greendex/config/languages";
import { expect, it } from "vitest";

import { getMessageDomain, messageDomains } from "@/messages/domains";

const root = fileURLToPath(new URL("../", import.meta.url));

function translatorViolations(file: string, source: string): string[] {
  const names = new Set(["useTranslations", "getTranslations"]);
  for (const imported of source.matchAll(
    /\bimport\s+(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["'](?:@greendex\/i18n\/(?:client|server)|next-intl(?:\/server)?)["']/g,
  )) {
    for (const specifier of imported[1].split(",")) {
      const match = specifier
        .trim()
        .match(/^(?:useTranslations|getTranslations)\s+as\s+([\w$]+)$/);
      if (match) names.add(match[1]);
    }
  }
  const callees = [...names].map((name) => name.replace(/\$/g, "\\$")).join("|");
  const calls = source.matchAll(
    new RegExp(
      `(?<![\\w$])(?:${callees})\\s*\\(\\s*(["'\u0060])([^"'\u0060]+)\\1`,
      "g",
    ),
  );
  const namespaces = new Set([...calls].map((match) => match[2]));
  const violations: string[] = [];
  for (const match of source.matchAll(
    new RegExp(
      `\\b(?:const|let)\\s+(\\w+)\\s*=\\s*(?:await\\s+)?(?:${callees})\\s*\\(`,
      "g",
    ),
  )) {
    if (match[1] !== "t")
      violations.push(`${file}: translator binding must be t`);
  }
  if (!namespaces.size) return violations;
  if (namespaces.size !== 1)
    violations.push(
      `${file}: multiple namespaces ${[...namespaces].sort().join(", ")}`,
    );
  const domain = getMessageDomain(file);
  if (!domain) violations.push(`${file}: no home bundle`);
  for (const namespace of namespaces) {
    if (namespace.split(".")[0] !== domain)
      violations.push(`${file}: ${namespace} is outside ${domain}`);
  }
  return violations;
}

it("assigns every translator file one literal namespace in its home bundle", () => {
  const violations: string[] = [];
  for (const file of globSync("**/*.{js,jsx,ts,tsx}", { cwd: root })) {
    if (/(?:^|\/)__tests__\/|\.(?:test|spec|stories)\./.test(file)) continue;
    violations.push(
      ...translatorViolations(file, readFileSync(`${root}${file}`, "utf8")),
    );
  }
  expect(violations).toEqual([]);
});

it.each([
  ["@greendex/i18n/client", "useTranslations", ""],
  ["next-intl", "useTranslations", ""],
  ["@greendex/i18n/server", "getTranslations", "await "],
  ["next-intl/server", "getTranslations", "await "],
])("checks imported translator aliases from %s", (module, name, awaitPrefix) => {
  const source = `import { ${name} as translate } from "${module}";\nconst t = ${awaitPrefix}translate("onboarding");`;
  expect(
    translatorViolations("features/authentication/example.tsx", source),
  ).toEqual([]);
  expect(
    translatorViolations("features/organizations/example.tsx", source),
  ).toContain(
    "features/organizations/example.tsx: onboarding is outside organizations",
  );
  expect(translatorViolations("unmapped/example.tsx", source)).toContain(
    "unmapped/example.tsx: no home bundle",
  );
  expect(
    translatorViolations(
      "features/authentication/example.tsx",
      source.replace("const t", "const other"),
    ),
  ).toContain(
    "features/authentication/example.tsx: translator binding must be t",
  );
  expect(
    translatorViolations(
      "features/authentication/example.tsx",
      `${source}\nconst t = ${awaitPrefix}translate("organizations");`,
    ),
  ).toContain(
    "features/authentication/example.tsx: multiple namespaces onboarding, organizations",
  );
});

it.each([
  ["components/error-presentation/api-error.tsx", "apiErrors"],
  ["components/error-boundary.tsx", "shell"],
  ["app/(setup)/setup-links/[id]/page.tsx", "partnerships"],
  ["app/(setup)/participant/page.tsx", "participations"],
  [
    "app/(setup)/participant-invitations/[invitationId]/page.tsx",
    "participations",
  ],
  ["app/(setup)/participant-links/[id]/page.tsx", "participations"],
  ["app/(setup)/participant-other/page.tsx", "onboarding"],
  ["app/(setup)/accept-invitation/[[...invitationId]]/page.tsx", "onboarding"],
  ["app/(protected)/partnerships/[id]/claim/page.tsx", "claims"],
])("maps %s to %s", (file, domain) => {
  expect(getMessageDomain(file)).toBe(domain);
});

it("keeps every locale bundle rooted in its own domain", () => {
  const violations: string[] = [];
  for (const locale of LANGUAGE_CODES) {
    for (const domain of messageDomains) {
      const bundle = JSON.parse(
        readFileSync(`${root}messages/${locale}/${domain}.json`, "utf8"),
      );
      for (const key of Object.keys(bundle)) {
        if (key !== domain && !key.startsWith(`${domain}.`))
          violations.push(`${locale}/${domain}.json: foreign root ${key}`);
      }
    }
  }
  expect(violations).toEqual([]);
});

it("reserves apiErrors translation for the shared presentation owner", () => {
  const source = 'const t = useTranslations("apiErrors");';
  expect(
    translatorViolations("components/error-presentation/api-error.tsx", source),
  ).toEqual([]);
  expect(
    translatorViolations("features/claims/components/form.tsx", source),
  ).toEqual(["features/claims/components/form.tsx: apiErrors is outside claims"]);
  expect(translatorViolations("components/navigation.tsx", source)).toEqual([
    "components/navigation.tsx: apiErrors is outside shell",
  ]);
});
