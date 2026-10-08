// @vitest-environment node
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { Pool } from "pg";
import { expect, it } from "vitest";

const execute = promisify(execFile);

it("seeds a shared Project, Participant Journey and allocated editable Claim from zero", async () => {
  const name = `development_seed_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString(), max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    const options = {
      cwd: resolve(import.meta.dirname, "../../../.."),
      env: { ...process.env, DATABASE_URL: url.toString() },
    };
    await execute("pnpm", ["run", "db:migrate"], options);
    // Capture output: even legacy seeders must not leak login credentials into diagnostics.
    try {
      await execute("pnpm", ["run", "db:seed"], options);
    } catch {
      throw new Error("Development seed command failed");
    }
    const result = await pool.query(`
      SELECT hosting.slug AS hosting_slug, partner.slug AS partner_slug,
        p.name AS project_name, participant.display_name,
        journey.origin, journey.destination, journey.trip_type,
        journey.erasmus_distance_km, claim.status,
        entry.transport_profile, entry.amount_eur,
        allocation.amount_eur AS allocated_amount_eur,
        snapshot.rules_version, snapshot.participant_transport_profiles,
        (SELECT o.slug FROM member m JOIN organization o ON o.id = m.organization_id WHERE m.user_id = participant.user_id ORDER BY m.created_at DESC LIMIT 1) AS default_organization_slug,
        (SELECT count(*)::int FROM project_funding_band WHERE project_id = p.id) AS funding_bands,
        (SELECT count(*)::int FROM partner_coordinator_assignment WHERE partnership_id = partnership.id) AS partner_coordinators,
        (SELECT count(*)::int FROM member WHERE organization_id = partner.id AND role = 'owner') AS partner_owners
      FROM project p
      JOIN organization hosting ON hosting.id = p.organization_id
      JOIN project_partner_organization partnership ON partnership.project_id = p.id
      JOIN organization partner ON partner.id = partnership.organization_id
      JOIN project_participant participant ON participant.project_id = p.id AND participant.represented_organization_id = partner.id
      JOIN participant_journey journey ON journey.project_participant_id = participant.id
      JOIN claim ON claim.partnership_id = partnership.id
      JOIN travel_cost_entry entry ON entry.claim_id = claim.id
      JOIN cost_allocation allocation ON allocation.travel_cost_entry_id = entry.id AND allocation.project_participant_id = participant.id
      JOIN project_funding_snapshot snapshot ON snapshot.project_id = p.id
    `);
    expect(result.rows).toEqual([
      expect.objectContaining({
        default_organization_slug: "seed-org",
        hosting_slug: "seed-org",
        partner_slug: "seed-partner-org",
        project_name: "Carbon Footprint Workshop",
        origin: "Paris",
        destination: "Berlin",
        trip_type: "round-trip",
        erasmus_distance_km: "878.00",
        status: "editable",
        transport_profile: "train",
        amount_eur: "120.00",
        allocated_amount_eur: "120.00",
        rules_version: TRAVEL_FUNDING_RULES.version,
        participant_transport_profiles: [
          ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
        ],
        funding_bands: TRAVEL_FUNDING_RULES.bands.length,
        partner_coordinators: 1,
        partner_owners: 1,
      }),
    ]);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}, 60_000);
