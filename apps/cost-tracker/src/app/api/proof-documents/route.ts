import {
  ProofAccessDenied,
  uploadProofDocument,
} from "@/features/projects/procedures/documents";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  // Multipart uploads use the same session and Partner-coordinator scope as oRPC.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session || !session.user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
    return Response.json({ error: "File is too large." }, { status: 413 });
  let data: FormData;
  try {
    // Do not trust Content-Length; cap streamed bytes before multipart parsing.
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "Invalid upload." }, { status: 400 });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 11 * 1024 * 1024) {
        await reader.cancel();
        return Response.json({ error: "File is too large." }, { status: 413 });
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
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const partnershipId = data.get("partnershipId");
  const file = data.get("file");
  if (typeof partnershipId !== "string" || !(file instanceof File))
    return Response.json(
      { error: "Select a file and Partnership." },
      { status: 400 },
    );
  try {
    const result = await uploadProofDocument({
      partnershipId,
      file,
      actorId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId,
    });
    return Response.json(
      result.status === 201
        ? result.document
        : {
            error:
              "Choose a PDF, JPEG, or PNG under 10 MB for an editable Claim.",
          },
      { status: result.status },
    );
  } catch (error) {
    if (error instanceof ProofAccessDenied)
      return Response.json({ error: "Access denied." }, { status: 403 });
    console.error("[Proof upload]", error);
    return Response.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
