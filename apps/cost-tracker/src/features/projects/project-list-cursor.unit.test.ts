import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decodeProjectListCursor,
  encodeProjectListCursor,
  getProjectListFingerprint,
  type ProjectListCursor,
} from "@/features/projects/project-list-cursor.server";

const fingerprintInput = {
  scope: "hosted" as const,
  search: "climate",
  window: "open" as const,
  sort: "operational" as const,
  pageSize: 25 as const,
  partnerOrganizationIds: ["partner-2", "partner-1"],
};

function buildCursor(fingerprint: string): ProjectListCursor {
  return {
    version: 2,
    direction: "next",
    fingerprint,
    sort: "operational",
    id: "project-1",
    date: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    open: true,
  };
}

describe("project list cursor", () => {
  it("seals the exact filter set into a stable fingerprint", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);

    expect(getProjectListFingerprint(fingerprintInput)).toBe(fingerprint);
    expect(
      getProjectListFingerprint({ ...fingerprintInput, search: "other" }),
    ).not.toBe(fingerprint);
  });

  it("ignores partner filter order in the fingerprint", () => {
    expect(
      getProjectListFingerprint({
        ...fingerprintInput,
        partnerOrganizationIds: ["partner-1", "partner-2"],
      }),
    ).toBe(getProjectListFingerprint(fingerprintInput));
  });

  it("round-trips a cursor sealed with the same fingerprint", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);
    const cursor = buildCursor(fingerprint);

    const decoded = decodeProjectListCursor(
      encodeProjectListCursor(cursor),
      fingerprint,
    );

    expect(decoded).toEqual({ status: "valid", cursor });
  });

  it("rejects a cursor sealed with different filters", () => {
    const cursor = buildCursor(getProjectListFingerprint(fingerprintInput));
    const otherFingerprint = getProjectListFingerprint({
      ...fingerprintInput,
      window: "closed",
    });

    expect(
      decodeProjectListCursor(encodeProjectListCursor(cursor), otherFingerprint)
        .status,
    ).toBe("invalid");
  });

  it("rejects tampered or garbage input without throwing", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);

    expect(decodeProjectListCursor("not-a-cursor", fingerprint).status).toBe(
      "invalid",
    );
    expect(
      decodeProjectListCursor(
        Buffer.from(JSON.stringify({ version: 2 }), "utf8").toString("base64url"),
        fingerprint,
      ).status,
    ).toBe("invalid");
  });

  it("ignores cursors from an older format version", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);
    const legacy = Buffer.from(
      JSON.stringify({ version: 1, id: "project-1" }),
      "utf8",
    ).toString("base64url");

    expect(decodeProjectListCursor(legacy, fingerprint).status).toBe(
      "unsupported-version",
    );
  });
});
