import "server-only";
import { createHash } from "node:crypto";

import { db } from "@greendex/database";
import { participantEntryTokensTable as tokens } from "@greendex/database/schema";
import { and, eq, sql } from "drizzle-orm";

import { secretHash } from "@/features/authentication/procedures/shared";
import { sendParticipantInvitation } from "@/lib/email";

/**
 * Sends the invitation email only for a durably issued, still-live identity.
 * The invitation row is committed before this runs, so a delivery failure
 * stays retryable through reissue without duplicate or inconsistent grants.
 */
export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
  secret: string,
) {
  try {
    const [live] = await db
      .select({ id: tokens.id })
      .from(tokens)
      .where(
        and(
          eq(tokens.id, invitationId),
          eq(tokens.status, "pending"),
          sql`${tokens.expiresAt} > now()`,
          sql`lower(${tokens.email}) = ${email}`,
          eq(tokens.secretHash, secretHash(secret)),
        ),
      )
      .limit(1);
    if (!live) {
      console.info("Superseded Participant Invitation delivery skipped.");
      return { invitationId, secret, delivery: "failed" as const };
    }
    // Do not hold a DB lock across SMTP latency. A rotation in the check-to-send
    // window can deliver a dead link, but acceptance rejects it without state change.
    await sendParticipantInvitation({ email, invitationId, secret });
    return { invitationId, secret, delivery: "sent" as const };
  } catch {
    // The invitation is committed; correlate failures without logging bearer or error content.
    console.error("Participant Invitation email delivery failed.", {
      invitationIdHashPrefix: createHash("sha256")
        .update(invitationId)
        .digest("hex")
        .slice(0, 8),
    });
    return { invitationId, secret, delivery: "failed" as const };
  }
}
