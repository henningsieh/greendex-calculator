import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decodeProjectListCursor,
  encodeProjectListCursor,
  getProjectListFingerprint,
  type ProjectListCursor,
} from "@/features/projects/list-cursor.server";

const fingerprintInput = {
  scope: "hosted" as const,
  search: "climate",
  status: ["open", "ready"] as const,
  sort: [{ field: "startDate" as const, direction: "asc" as const }],
  pageSize: 25 as const,
  partnerOrganizationIds: ["partner-2", "partner-1"],
};

function buildCursor(fingerprint: string): ProjectListCursor {
  return {
    version: 5,
    direction: "next",
    fingerprint,
    id: "project-1",
    values: [
      {
        field: "startDate",
        value: new Date("2026-06-01T00:00:00.000Z").toISOString(),
      },
    ],
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

  it("ignores filter order in the fingerprint", () => {
    expect(
      getProjectListFingerprint({
        ...fingerprintInput,
        status: ["ready", "open"],
        partnerOrganizationIds: ["partner-1", "partner-2"],
      }),
    ).toBe(getProjectListFingerprint(fingerprintInput));
  });

  it("rejects a cursor after the Status selection changes", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);
    const encoded = encodeProjectListCursor(buildCursor(fingerprint));
    const archived = getProjectListFingerprint({
      ...fingerprintInput,
      status: ["archived"],
    });
    const all = getProjectListFingerprint({
      ...fingerprintInput,
      status: [],
    });
    expect(decodeProjectListCursor(encoded, archived).status).toBe("invalid");
    expect(decodeProjectListCursor(encoded, all).status).toBe("invalid");
  });

  it("rejects cursors when priority or direction changes", () => {
    const sort = [
      { field: "name" as const, direction: "asc" as const },
      { field: "startDate" as const, direction: "desc" as const },
    ];
    const fingerprint = getProjectListFingerprint({ ...fingerprintInput, sort });
    const cursor: ProjectListCursor = {
      version: 5,
      direction: "next",
      fingerprint,
      id: "project-1",
      values: [
        { field: "name" },
        { field: "startDate", value: "2026-01-01T00:00:00.000Z" },
      ],
    };
    const encoded = encodeProjectListCursor(cursor);
    expect(
      decodeProjectListCursor(
        encoded,
        getProjectListFingerprint({
          ...fingerprintInput,
          sort: [...sort].reverse(),
        }),
      ).status,
    ).toBe("invalid");
    expect(
      decodeProjectListCursor(
        encoded,
        getProjectListFingerprint({
          ...fingerprintInput,
          sort: [sort[0]!, { ...sort[1]!, direction: "asc" }],
        }),
      ).status,
    ).toBe("invalid");
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
      search: "different",
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
        Buffer.from(JSON.stringify({ version: 5 }), "utf8").toString("base64url"),
        fingerprint,
      ).status,
    ).toBe("invalid");
  });

  it("ignores cursors from an older format version", () => {
    const fingerprint = getProjectListFingerprint(fingerprintInput);
    const legacy = Buffer.from(
      JSON.stringify({ version: 4, id: "project-1" }),
      "utf8",
    ).toString("base64url");

    expect(decodeProjectListCursor(legacy, fingerprint).status).toBe(
      "unsupported-version",
    );
  });
});
