import { ORPCError } from "@orpc/server";

import {
  downloadProofDocument,
  uploadProofDocument,
} from "@/features/projects/procedures/documents";
import { auth } from "@/lib/auth";
import {
  getSafeErrorSituation,
  toSafeErrorResponse,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

const proofErrors = createSituationErrors();

function proofErrorResponse(error: unknown, fallback: "upload" | "download") {
  const situation =
    error instanceof ORPCError ? getSafeErrorSituation(error) : undefined;
  if (situation) return toSafeErrorResponse(situation);
  console.error(`[Proof ${fallback}]`, error);
  return proofErrorResponse(
    fallback === "upload"
      ? proofErrors.proofUploadFailed()
      : proofErrors.proofDownloadFailed(),
    fallback,
  );
}

// Uploaded proof bytes in megabytes; mirrored in the streamed-bytes cap below.
const MAX_UPLOAD_BYTES = 11 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.session || !session.user)
      return proofErrorResponse(proofErrors.unauthenticated(), "download");
    const { searchParams } = new URL(request.url);
    const partnershipId = searchParams.get("partnershipId") ?? "";
    const documentId = searchParams.get("documentId") ?? "";
    const document = await downloadProofDocument({
      partnershipId,
      documentId,
      actorId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId,
    });
    // Never interpolate a stored filename into a header without encoding it.
    const fileName = encodeURIComponent(document.fileName).replaceAll("'", "%27");
    return new Response(new Uint8Array(document.bytes), {
      headers: {
        "Content-Type": ["application/pdf", "image/jpeg", "image/png"].includes(
          document.mediaType,
        )
          ? document.mediaType
          : "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return proofErrorResponse(error, "download");
  }
}

export async function POST(request: Request) {
  // Allowed multipart exception to the oRPC-only seam (architecture.md):
  // typed oRPC procedures cannot stream upload progress, so this route only
  // enforces transport-level gates (origin, session, size caps) and delegates
  // all authorization plus persistence to the owning feature procedure.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return proofErrorResponse(proofErrors.proofOriginDenied(), "upload");
  }
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.session || !session.user)
      return proofErrorResponse(proofErrors.unauthenticated(), "upload");
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES)
      return proofErrorResponse(proofErrors.proofTransportTooLarge(), "upload");
    let data: FormData;
    try {
      // Do not trust Content-Length; cap streamed bytes before multipart parsing.
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = request.body?.getReader();
      if (!reader)
        return proofErrorResponse(proofErrors.proofMultipartInvalid(), "upload");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_UPLOAD_BYTES) {
          await reader.cancel();
          return proofErrorResponse(
            proofErrors.proofTransportTooLarge(),
            "upload",
          );
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      data = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") ?? "" },
        body: new Blob([bytes]),
      }).formData();
    } catch {
      return proofErrorResponse(proofErrors.proofMultipartInvalid(), "upload");
    }
    const partnershipId = data.get("partnershipId");
    const file = data.get("file");
    if (typeof partnershipId !== "string" || !(file instanceof File))
      return proofErrorResponse(proofErrors.proofSelectionRequired(), "upload");
    const result = await uploadProofDocument({
      partnershipId,
      file,
      actorId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId,
    });
    return Response.json(result.document, { status: result.status });
  } catch (error) {
    return proofErrorResponse(error, "upload");
  }
}
