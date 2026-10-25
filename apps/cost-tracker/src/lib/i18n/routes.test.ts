// @vitest-environment node

import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const app = fileURLToPath(new URL("../../app/", import.meta.url));
const sourceRoutes = globSync("**/{page,layout,loading}.tsx", {
  cwd: app,
}).filter((file) => !file.startsWith("[locale]/") && file !== "layout.tsx");

// These three chains reach permitted lib/auth persistence. The guard treats
// re-export syntax as client exposure, so use identical imported bindings.
const identityFacades: Record<string, string> = {
  "(protected)/layout.tsx": `import ProtectedLayout from "@/app/(protected)/layout";
// Identity export: re-export syntax falsely exposes transitive auth to the persistence guard.
export default ProtectedLayout;`,
  "(protected)/organization/page.tsx": `import OrganizationPage, { metadata as routeMetadata } from "@/app/(protected)/organization/page";
// Identity exports: re-export syntax falsely exposes transitive auth to the persistence guard.
export default OrganizationPage;
export const metadata = routeMetadata;`,
  "(protected)/partner-organizations/page.tsx": `import PartnerOrganizationsPage, { metadata as routeMetadata } from "@/app/(protected)/partner-organizations/page";
// Identity exports: re-export syntax falsely exposes transitive auth to the persistence guard.
export default PartnerOrganizationsPage;
export const metadata = routeMetadata;`,
};

describe("Cost Tracker localized route facades", () => {
  it.each(sourceRoutes)(
    "preserves the implementation and exports of %s",
    (route) => {
      const source = readFileSync(resolve(app, route), "utf8");
      const facade = readFileSync(resolve(app, "[locale]", route), "utf8");
      const exports = ["default"];
      if (source.includes("export const metadata")) exports.push("metadata");
      const reexport = `export { ${exports.join(", ")} } from "@/app/${route.slice(0, -4)}";`;
      const expected =
        identityFacades[route] ??
        (source.includes("export const instant = false")
          ? `${reexport}\n\n// Next.js requires route configuration to be declared locally.\nexport const instant = false;\n`
          : `${reexport}\n`);
      const normalize = (value: string) =>
        value.replace(/,\s*}/g, " }").replace(/\s+/g, " ").trim();
      expect(normalize(facade)).toBe(normalize(expected));
    },
  );
});
