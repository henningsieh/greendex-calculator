import "server-only";
import { createHash, randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimsTable as claims,
  proofDocumentsTable as documents,
} from "@greendex/database/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { canPartnerEditClaim } from "@/features/claims/claim-lifecycle";
import { lockClaimScope } from "@/features/claims/procedures/claim-locks";
import { ClaimScopeInputSchema } from "@/features/claims/validation-schemas";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/partnerships/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";
import { getProofFile, putProofFile } from "@/lib/proof-storage";

const documentOutput = z.object({
  id: z.string(),
  originalFileName: z.string(),
  mediaType: z.string(),
  byteSize: z.number(),
});
const projection = {
  id: documents.id,
  originalFileName: documents.originalFileName,
  mediaType: documents.mediaType,
  byteSize: documents.byteSize,
};

async function requirePartner(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Parameters<typeof requirePartnerCoordination>[3],
) {
  const scope = await requirePartnerCoordination(
    partnershipId,
    actorId,
    activeOrganizationId,
    errors,
  );
  if (scope.partnerId !== activeOrganizationId)
    throw createSituationErrors(errors).partnerDocumentsRequired();
  return scope;
}

export const list = authorized
  .input(ClaimScopeInputSchema)
  .output(z.array(documentOutput))
  .handler(async ({ input, context, errors }) => {
    await requirePartner(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [claim] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.partnershipId, input.partnershipId))
      .limit(1);
    if (!claim) return [];
    return db
      .select(projection)
      .from(documents)
      .where(eq(documents.claimId, claim.id));
  });

const proofErrors = createSituationErrors();

/** Called by the download route; authorize the Partnership before resolving its Claim-owned object key. */
export async function downloadProofDocument(input: {
  partnershipId: string;
  documentId: string;
  actorId: string;
  activeOrganizationId: string | null | undefined;
}) {
  if (
    !ClaimScopeInputSchema.safeParse({ partnershipId: input.partnershipId })
      .success ||
    !coordinationId.safeParse(input.documentId).success
  ) {
    throw proofErrors.proofNotFound();
  }
  // The same oversight grant as Claim review: Hosting Owners/Admins or assigned
  // Project Coordinators; Partner staff retain their existing scope.
  await requirePartnerCoordination(
    input.partnershipId,
    input.actorId,
    input.activeOrganizationId,
    {},
  );
  const [document] = await db
    .select({
      fileReference: documents.fileReference,
      originalFileName: documents.originalFileName,
      mediaType: documents.mediaType,
    })
    .from(documents)
    .innerJoin(claims, eq(documents.claimId, claims.id))
    .where(
      and(
        eq(claims.partnershipId, input.partnershipId),
        eq(documents.id, input.documentId),
      ),
    )
    .limit(1);
  if (!document) throw proofErrors.proofNotFound();
  const bytes = await getProofFile(document.fileReference);
  return {
    bytes,
    fileName: document.originalFileName,
    mediaType: document.mediaType,
  };
}

const allowedMediaTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maximumBytes = 10 * 1024 * 1024;
// #378: per-claim upload quota. Counts and bytes come from stored rows
// only — no clock windows, no new tables. The claim row is already
// row-locked above, so concurrent uploads to the same claim serialize
// and cannot both slip past the check.
const maximumDocumentsPerClaim = 25;
const maximumBytesPerClaim = 100 * 1024 * 1024;

/**
 * #374: server-side magic-byte sniffing for the proof allowlist. The
 * multipart `File.type` is client-supplied and untrusted, so only the
 * sniffed type decides what is stored and served. Dependency-free on
 * purpose: exactly three allowlisted types with crisp magic numbers.
 */
const proofMagicTypes = [
  {
    mediaType: "application/pdf",
    match: (bytes: Uint8Array) =>
      bytes.length >= 5 &&
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46 && // F
      bytes[4] === 0x2d, // -
  },
  {
    mediaType: "image/jpeg",
    match: (bytes: Uint8Array) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  {
    mediaType: "image/png",
    match: (bytes: Uint8Array) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 && // P
      bytes[2] === 0x4e && // N
      bytes[3] === 0x47 && // G
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
] as const;

export function sniffProofMediaType(bytes: Uint8Array): string | null {
  for (const candidate of proofMagicTypes) {
    if (candidate.match(bytes)) return candidate.mediaType;
  }
  return null;
}

/** Called by the multipart route only; the Claim lock protects editable status across the upload. */
export async function uploadProofDocument(input: {
  partnershipId: string;
  file: File;
  actorId: string;
  activeOrganizationId: string | null | undefined;
}) {
  const parsed = ClaimScopeInputSchema.safeParse({
    partnershipId: input.partnershipId,
  });
  if (!parsed.success || !(input.file instanceof File))
    throw proofErrors.proofSelectionRequired();
  if (!allowedMediaTypes.has(input.file.type))
    throw proofErrors.proofMediaUnsupported();
  if (input.file.size < 1) throw proofErrors.proofFileEmpty();
  if (input.file.size > maximumBytes) throw proofErrors.proofFileTooLarge();
  if (!input.file.name.trim()) throw proofErrors.proofFileNameRequired();
  const scope = await requirePartner(
    input.partnershipId,
    input.actorId,
    input.activeOrganizationId,
    {},
  );
  // Never materialize an empty Claim from a file upload. First save is explicit.
  return db.transaction(async (tx) => {
    // Shared lock order: the Claim lock keeps editable status across the upload.
    const { claim } = await lockClaimScope(
      tx,
      {
        projectId: scope.projectId,
        partnershipId: parsed.data.partnershipId,
        partnerOrganizationId: scope.partnerId,
      },
      {},
      "claim",
    );
    if (!claim) throw proofErrors.claimRequiredForProof();
    if (!canPartnerEditClaim(claim.status)) throw proofErrors.claimNotEditable();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    // #374: File.type is client-supplied. Only the sniffed magic-byte type
    // is authoritative: a spoofed label is rejected even when it names an
    // allowlisted type, and the stored/served ContentType always matches
    // the verified bytes.
    const sniffedMediaType = sniffProofMediaType(bytes);
    if (sniffedMediaType === null || sniffedMediaType !== input.file.type)
      throw proofErrors.proofMediaUnsupported();
    const [usage] = await tx
      .select({
        documentCount: count(documents.id),
        totalBytes: sql<number>`coalesce(sum(${documents.byteSize}), 0)`.mapWith(
          Number,
        ),
      })
      .from(documents)
      .where(eq(documents.claimId, claim.id))
      .limit(1);
    const existingCount = Number(usage?.documentCount ?? 0);
    const existingBytes = Number(usage?.totalBytes ?? 0);
    if (
      existingCount >= maximumDocumentsPerClaim ||
      existingBytes + bytes.length > maximumBytesPerClaim
    )
      throw proofErrors.proofQuotaExceeded();
    const reference = `claims/${scope.partnerId}/${claim.id}/${randomUUID()}`;
    await putProofFile(reference, bytes, sniffedMediaType);
    const [saved] = await tx
      .insert(documents)
      .values({
        claimId: claim.id,
        fileReference: reference,
        originalFileName: input.file.name.slice(0, 255),
        mediaType: sniffedMediaType,
        byteSize: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
      })
      .returning(projection);
    if (!saved) {
      console.error("[Proof upload] Insert returned no document");
      throw proofErrors.proofUploadFailed();
    }
    return { status: 201 as const, document: saved };
  });
}
