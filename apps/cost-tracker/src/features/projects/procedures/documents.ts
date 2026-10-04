import "server-only";
import { createHash, randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimsTable as claims,
  proofDocumentsTable as documents,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { canPartnerEditClaim } from "@/features/projects/claim-lifecycle";
import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";
import { getProofFile, putProofFile } from "@/lib/proof-storage";

const scopeInput = z.object({ partnershipId: coordinationId });
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
  .input(scopeInput)
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
    !scopeInput.safeParse({ partnershipId: input.partnershipId }).success ||
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

/** Called by the multipart route only; the Claim lock protects editable status across the upload. */
export async function uploadProofDocument(input: {
  partnershipId: string;
  file: File;
  actorId: string;
  activeOrganizationId: string | null | undefined;
}) {
  const parsed = scopeInput.safeParse({ partnershipId: input.partnershipId });
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
    if (!canPartnerEditClaim(claim.status))
      throw proofErrors.claimNotEditable();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const reference = `claims/${scope.partnerId}/${claim.id}/${randomUUID()}`;
    await putProofFile(reference, bytes, input.file.type);
    const [saved] = await tx
      .insert(documents)
      .values({
        claimId: claim.id,
        fileReference: reference,
        originalFileName: input.file.name.slice(0, 255),
        mediaType: input.file.type,
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
