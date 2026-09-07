import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./0018_enforce_project_organization_invariants.sql", import.meta.url),
  "utf8",
);

describe("Project Organization invariant migration", () => {
  it("rejects assigning the owning Organization as a Partner Organization", () => {
    expect(migration).toContain("project_partner_organization_valid");
    expect(migration).toContain(
      "A Project owning Organization cannot also be a Partner Organization",
    );
  });

  it("enforces represented Organization validity across Project tables", () => {
    expect(migration).toContain(
      "project_participant_represented_organization_valid",
    );
    expect(migration).toContain("project_partner_organization_in_use");
    expect(migration).toContain("DEFERRABLE INITIALLY IMMEDIATE");
  });
});
