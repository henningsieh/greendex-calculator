import { describe, expect, it } from "vitest";

import {
  ClaimPaidPayloadV1Schema,
  createClaimPaidEvent,
  notificationDedupeKey,
  parseNotificationEvent,
} from "./catalog";

const payload = {
  projectId: "project-1",
  partnershipId: "partnership-1",
  claimId: "claim-1",
  amountEur: "1250.00",
  actorUserId: "user-1",
};

describe("notification catalog", () => {
  it("accepts the claim.paid v1 payload with exact EUR cents", () => {
    expect(ClaimPaidPayloadV1Schema.parse(payload)).toEqual(payload);
  });

  it("rejects incomplete, malformed, and unknown payload fields", () => {
    expect(
      ClaimPaidPayloadV1Schema.safeParse({ ...payload, claimId: undefined })
        .success,
    ).toBe(false);
    expect(
      ClaimPaidPayloadV1Schema.safeParse({ ...payload, amountEur: "12.345" })
        .success,
    ).toBe(false);
    expect(
      ClaimPaidPayloadV1Schema.safeParse({ ...payload, extra: "leak" }).success,
    ).toBe(false);
  });

  it("keys duplicates by the Claim the event describes", () => {
    const event = createClaimPaidEvent(payload);
    expect(event).toMatchObject({ type: "claim.paid", version: 1 });
    expect(notificationDedupeKey(event)).toBe("claim-1");
  });

  it("rehydrates only known event types, versions, and valid payloads", () => {
    expect(
      parseNotificationEvent({
        eventType: "claim.paid",
        eventVersion: 1,
        payload,
      }),
    ).toEqual({ type: "claim.paid", version: 1, payload });
    expect(
      parseNotificationEvent({
        eventType: "claim.submitted",
        eventVersion: 1,
        payload,
      }),
    ).toBeUndefined();
    expect(
      parseNotificationEvent({
        eventType: "claim.paid",
        eventVersion: 2,
        payload,
      }),
    ).toBeUndefined();
    expect(
      parseNotificationEvent({
        eventType: "claim.paid",
        eventVersion: 1,
        payload: { ...payload, amountEur: null },
      }),
    ).toBeUndefined();
  });
});
