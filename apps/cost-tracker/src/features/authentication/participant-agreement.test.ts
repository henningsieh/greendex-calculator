// @vitest-environment node

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  AGREEMENT_COPY,
  CURRENT_PARTICIPANT_AGREEMENT_VERSION,
  isPublishedAgreement,
} from "@/features/authentication/participant-agreement";

describe("development Participant Agreement", () => {
  it("binds the current version to the exact UTF-8 copy", () => {
    expect(
      createHash("sha256").update(AGREEMENT_COPY, "utf8").digest("hex"),
    ).toBe(CURRENT_PARTICIPANT_AGREEMENT_VERSION.contentHash);
    expect(isPublishedAgreement(CURRENT_PARTICIPANT_AGREEMENT_VERSION)).toBe(
      true,
    );
  });
});
