import "server-only";
import { createHash } from "node:crypto";

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
  } catch {
    // The invitation is committed; correlate failures without logging bearer or error content.
    console.error("Participant Invitation email delivery failed.", {
      invitationIdHashPrefix: createHash("sha256")
        .update(invitationId)
        .digest("hex")
        .slice(0, 8),
    });
    return { invitationId, delivery: "failed" as const };
  }
}
