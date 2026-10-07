import "server-only";
import { randomBytes } from "node:crypto";

import { db } from "@greendex/database";
import { participantEntryTokensTable as tokens } from "@greendex/database/schema";
import type { ORPCErrorConstructorMap } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { secretHash } from "@/features/authentication/procedures/shared";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

type ProcedureErrors = ORPCErrorConstructorMap<
  (typeof authorized)["~orpc"]["errorMap"]
>;

export type EntryToken = typeof tokens.$inferSelect;

export type EntryTokenFlavour = "invitation" | "link";

export type EntryTokenTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

/** Invitations expire after their TTL; shareable links never expire (ADR-0005:
 * link expiry does not live here, so the link flavour stores a null deadline). */
export function invitationTokenExpiry(ttlMs: number) {
  return new Date(Date.now() + ttlMs);
}

/** Durably issues one token of either flavour and returns its single-use secret. */
export async function issueEntryToken(
  errors: ProcedureErrors,
  input: {
    partnershipId: string;
    projectId: string;
    email: string | null;
    expiresAt: Date | null;
    issuedByUserId: string;
  },
  executor: Pick<typeof db, "insert"> = db,
) {
  const secret = randomBytes(32).toString("base64url");
  const [created] = await executor
    .insert(tokens)
    .values({
      partnershipId: input.partnershipId,
      projectId: input.projectId,
      email: input.email,
      secretHash: secretHash(secret),
      expiresAt: input.expiresAt,
      issuedByUserId: input.issuedByUserId,
    })
    .returning({ id: tokens.id });
  if (!created) throw createSituationErrors(errors).internalFailure();
  return { id: created.id, secret };
}

/** Resolves a token by identity and binds the flavour to the stored email. */
export async function resolveEntryToken(
  errors: ProcedureErrors,
  flavour: EntryTokenFlavour,
  input: { id: string; secret: string },
): Promise<EntryToken> {
  const [token] = await db
    .select()
    .from(tokens)
    .where(eq(tokens.id, input.id))
    .limit(1);
  if (!token || token.secretHash !== secretHash(input.secret))
    throw flavour === "invitation"
      ? createSituationErrors(errors).participantInvitationNotFound()
      : createSituationErrors(errors).registrationLinkNotFound();
  // A shareable link and an email-bound invitation never resolve as each other.
  if (flavour === "invitation" ? token.email === null : token.email !== null)
    throw flavour === "invitation"
      ? createSituationErrors(errors).participantInvitationNotFound()
      : createSituationErrors(errors).registrationLinkNotFound();
  return token;
}

/** Enforces redeemability: email binding first, then lifecycle state. */
export function requireTokenRedeemable(
  errors: ProcedureErrors,
  token: EntryToken,
  accountEmail: string,
) {
  if (token.email !== null) {
    // Only the verified account matching the bound email may redeem.
    // A forwarded link grants nothing to other accounts.
    if (token.email !== accountEmail.trim().toLowerCase())
      throw createSituationErrors(errors).participantInvitationWrongAccount();
    if (token.status !== "pending" && token.status !== "accepted")
      throw createSituationErrors(errors).participantInvitationClosed();
    if (
      token.status === "pending" &&
      token.expiresAt !== null &&
      token.expiresAt <= new Date()
    )
      throw createSituationErrors(errors).participantInvitationExpired();
  } else if (token.status !== "pending") {
    throw createSituationErrors(errors).registrationLinkClosed();
  }
}

/** Re-checks token state inside the join transaction against a row lock. */
export async function recheckEntryToken(
  tx: EntryTokenTransaction,
  errors: ProcedureErrors,
  token: EntryToken,
) {
  const [locked] = await tx
    .select({ status: tokens.status, expiresAt: tokens.expiresAt })
    .from(tokens)
    .where(
      and(eq(tokens.id, token.id), eq(tokens.partnershipId, token.partnershipId)),
    )
    .for("update")
    .limit(1);
  if (!locked)
    throw token.email !== null
      ? createSituationErrors(errors).participantInvitationNotFound()
      : createSituationErrors(errors).registrationLinkNotFound();
  // Repeat successful redemption of an invitation is safe; a consumed link
  // identity never exists because links are reusable and never marked accepted.
  if (
    locked.status !== "pending" &&
    (token.email === null || locked.status !== "accepted")
  )
    throw token.email !== null
      ? createSituationErrors(errors).participantInvitationClosed()
      : createSituationErrors(errors).registrationLinkClosed();
  if (
    token.email !== null &&
    locked.status === "pending" &&
    locked.expiresAt !== null &&
    locked.expiresAt <= new Date()
  )
    throw createSituationErrors(errors).participantInvitationExpired();
}

/** Marks an invitation consumed. Links stay reusable and are never consumed. */
export async function consumeEntryToken(
  tx: EntryTokenTransaction,
  tokenId: string,
) {
  await tx
    .update(tokens)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(tokens.id, tokenId));
}

/** Revokes one pending identity; newest-wins rotation revokes before issuing. */
export async function revokeEntryToken(tokenId: string) {
  await db
    .update(tokens)
    .set({ status: "revoked" })
    .where(and(eq(tokens.id, tokenId), eq(tokens.status, "pending")));
}

/** Transactional revoke for rotation inside the issuance transaction. */
export async function revokeEntryTokenInTransaction(
  tx: EntryTokenTransaction,
  tokenId: string,
) {
  await tx
    .update(tokens)
    .set({ status: "revoked" })
    .where(and(eq(tokens.id, tokenId), eq(tokens.status, "pending")));
}

/** Finds the pending invitation for one project email, if any. */
export async function findPendingInvitationToken(
  projectId: string,
  email: string,
  executor: Pick<typeof db, "select"> = db,
) {
  const [token] = await executor
    .select({
      id: tokens.id,
      partnershipId: tokens.partnershipId,
      expiresAt: tokens.expiresAt,
    })
    .from(tokens)
    .where(
      and(
        eq(tokens.projectId, projectId),
        eq(tokens.email, email),
        eq(tokens.status, "pending"),
      ),
    )
    .limit(1);
  return token;
}

/** Lists every token identity of one Partnership for Partner lifecycle views. */
export async function listEntryTokens(partnershipId: string) {
  return db.select().from(tokens).where(eq(tokens.partnershipId, partnershipId));
}
