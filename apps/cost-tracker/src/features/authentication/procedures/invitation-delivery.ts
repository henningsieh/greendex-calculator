import "server-only";
import { db } from "@greendex/database";
import {
  invitation,
  participantInvitationBridgesTable as bridges,
} from "@greendex/database/schema";
import { and, eq, gt, sql } from "drizzle-orm";

import { sendParticipantInvitation } from "@/lib/email";

export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
) {
  try {
    const [live] = await db
      .select({ invitationId: bridges.invitationId })
      .from(bridges)
      .innerJoin(invitation, eq(invitation.id, bridges.invitationId))
      .where(
        and(
          eq(bridges.invitationId, invitationId),
          eq(bridges.status, "pending"),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
          sql`lower(${invitation.email}) = ${email}`,
        ),
      )
      .limit(1);
    if (!live) {
      console.info("Superseded Participant Invitation delivery skipped.");
      return { invitationId, delivery: "failed" as const };
    }
    // Do not hold a DB lock across SMTP latency. A rotation in the check-to-send
    // window can deliver a dead link, but acceptance rejects it without state change.
    await sendParticipantInvitation({ email, invitationId });
    return { invitationId, delivery: "sent" as const };
  } catch (error) {
    // The invitation is committed; report failure without leaking SMTP details.
    // A short prefix identifies the failed send without exposing the invitation URL bearer.
    console.error("Participant Invitation email delivery failed.", {
      invitationIdPrefix: invitationId.slice(0, 8),
      cause: error instanceof Error ? error.name : typeof error,
    });
    return { invitationId, delivery: "failed" as const };
  }
}
