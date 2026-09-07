import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "./project-schema";

describe("Cost Tracker Project schema", () => {
  it("adds one Project-scoped cost submission window", () => {
    expect(projectsTable.costSubmissionWindowOpen.notNull).toBe(true);
    expect(projectsTable.costSubmissionWindowOpen.hasDefault).toBe(true);
  });

  it("uniquely assigns a Partner Organization to a Project", () => {
    const config = getTableConfig(projectPartnerOrganizationsTable);
    const uniqueIndex = config.indexes.find(
      (index) =>
        index.config.name === "project_partner_organization_project_org_unique",
    );

    expect(uniqueIndex?.config.unique).toBe(true);
    expect(uniqueIndex?.config.columns).toHaveLength(2);
  });

  it("models Project Participation without duplicating membership identity", () => {
    const columns = getTableConfig(projectParticipantsTable).columns.map(
      (column) => column.name,
    );

    expect(columns).toContain("represented_organization_id");
    expect(columns).toContain("display_name");
    expect(columns).toContain("user_id");
    expect(columns).not.toContain("member_id");
    expect(projectParticipantsTable.representedOrganizationId.notNull).toBe(true);
    expect(projectParticipantsTable.displayName.notNull).toBe(true);
    expect(projectParticipantsTable.userId.notNull).toBe(false);
    expect(projectParticipantsTable.country.notNull).toBe(false);
  });

  it("defines identity and merge constraints for Project Participation", () => {
    const config = getTableConfig(projectParticipantsTable);
    const indexNames = config.indexes.map((index) => index.config.name);
    const checkNames = config.checks.map((constraint) => constraint.name);

    expect(indexNames).toEqual(
      expect.arrayContaining([
        "project_participant_project_email_unique",
        "project_participant_project_user_unique",
      ]),
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "project_participant_email_normalized",
        "project_participant_not_merged_into_self",
        "project_participant_merge_fields_consistent",
      ]),
    );
  });
});
