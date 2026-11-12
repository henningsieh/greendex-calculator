import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ParticipantInvitationEmailInputSchema,
  SetParticipantInvitationOpenInputSchema,
  CreateParticipantRegistrationLinkInputSchema,
  SetParticipantRegistrationLinkOpenInputSchema,
  OnboardingProgressInputSchema,
} from "@/features/participant-onboarding/validation-schemas";

function issues(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => ({ path, message }));
}

describe("onboarding inputs", () => {
  it("normalizes email but preserves raw partnership IDs and strips unknown keys", () => {
    expect(
      ParticipantInvitationEmailInputSchema.parse({
        partnershipId: "  x ",
        email: " A@EXAMPLE.COM ",
        extra: true,
      }),
    ).toEqual({ partnershipId: "  x ", email: "a@example.com" });
    expect(
      issues(ParticipantInvitationEmailInputSchema, {
        partnershipId: "x",
        email: "bad",
      }),
    ).toEqual([{ path: ["email"], message: "Invalid email address" }]);
  });
  it("preserves raw identifier length and whitespace", () => {
    expect(
      ParticipantInvitationEmailInputSchema.parse({
        partnershipId: " ",
        email: "x@example.com",
      }),
    ).toEqual({ partnershipId: " ", email: "x@example.com" });
    expect(
      SetParticipantInvitationOpenInputSchema.parse({
        invitationId: " ",
        open: true,
      }),
    ).toEqual({ invitationId: " ", open: true });
    expect(
      SetParticipantRegistrationLinkOpenInputSchema.parse({
        id: " ",
        open: true,
      }),
    ).toEqual({ id: " ", open: true });
    expect(
      issues(SetParticipantRegistrationLinkOpenInputSchema, {
        id: ` ${"x".repeat(128)}`,
        open: true,
      }),
    ).toEqual([
      {
        path: ["id"],
        message: "Too big: expected string to have <=128 characters",
      },
    ]);
    expect(
      CreateParticipantRegistrationLinkInputSchema.parse({ partnershipId: " " }),
    ).toEqual({ partnershipId: " " });
    expect(
      CreateParticipantRegistrationLinkInputSchema.parse({
        partnershipId: "x".repeat(128),
      }),
    ).toEqual({ partnershipId: "x".repeat(128) });
    expect(
      issues(CreateParticipantRegistrationLinkInputSchema, {
        partnershipId: "x".repeat(129),
      }),
    ).toEqual([
      {
        path: ["partnershipId"],
        message: "Too big: expected string to have <=128 characters",
      },
    ]);
    expect(
      issues(CreateParticipantRegistrationLinkInputSchema, { partnershipId: "" }),
    ).toEqual([
      {
        path: ["partnershipId"],
        message: "Too small: expected string to have >=1 characters",
      },
    ]);
  });
  it("requires booleans for both open inputs", () => {
    expect(
      SetParticipantInvitationOpenInputSchema.parse({
        invitationId: " x ",
        open: false,
        extra: 1,
      }),
    ).toEqual({ invitationId: " x ", open: false });
    expect(
      SetParticipantRegistrationLinkOpenInputSchema.parse({
        id: "x",
        open: true,
      }),
    ).toEqual({ id: "x", open: true });
    expect(
      issues(SetParticipantInvitationOpenInputSchema, { invitationId: "x" }),
    ).toEqual([
      {
        path: ["open"],
        message: "Invalid input: expected boolean, received undefined",
      },
    ]);
    expect(
      issues(SetParticipantRegistrationLinkOpenInputSchema, {
        id: "x",
        open: "true",
      }),
    ).toEqual([
      {
        path: ["open"],
        message: "Invalid input: expected boolean, received string",
      },
    ]);
  });
  it("trims the progress partnership ID", () => {
    expect(
      OnboardingProgressInputSchema.parse({ partnershipId: " x ", extra: 1 }),
    ).toEqual({ partnershipId: "x" });
    expect(issues(OnboardingProgressInputSchema, { partnershipId: " " })).toEqual(
      [
        {
          path: ["partnershipId"],
          message: "Too small: expected string to have >=1 characters",
        },
      ],
    );
  });
});
