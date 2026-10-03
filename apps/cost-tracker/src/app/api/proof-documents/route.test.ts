// @vitest-environment node
import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/features/projects/procedures/documents", () => ({
  downloadProofDocument: mocks.download,
  uploadProofDocument: mocks.upload,
}));
import { GET, POST } from "@/app/api/proof-documents/route";
import { situationCatalog } from "@/lib/orpc/error-contract";

const url = "http://localhost/api/proof-documents";
function multipart() {
  const form = new FormData();
  form.set("partnershipId", "own");
  form.set(
    "file",
    new File(["proof bytes"], "receipt.pdf", { type: "application/pdf" }),
  );
  return new Request(url, {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form,
  });
}
async function expectSituation(
  response: Response,
  name: keyof typeof situationCatalog,
) {
  const situation = situationCatalog[name];
  expect(response.status).toBe(situation.status);
  expect(await response.json()).toEqual({
    error: situation.message,
    code: situation.code,
    reason: situation.reason,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "partner" },
  });
  mocks.download.mockResolvedValue({
    bytes: Buffer.from([1, 2, 3]),
    fileName: "receipt.pdf",
    mediaType: "application/pdf",
  });
  mocks.upload.mockResolvedValue({ status: 201, document: { id: "proof" } });
});
describe("Proof transport semantic adapters", () => {
  it.each(Object.entries(situationCatalog))(
    "maps every approved semantic outcome, ignoring remote copy: %s",
    async (_name, situation) => {
      const error = new ORPCError(situation.code, {
        message: "SQL secret token",
        data: { reason: situation.reason },
      });
      mocks.download.mockRejectedValue(error);
      mocks.upload.mockRejectedValue(error);
      for (const response of [
        await GET(new Request(url)),
        await POST(multipart()),
      ]) {
        expect(response.status).toBe(situation.status);
        expect(await response.json()).toEqual({
          error: situation.message,
          code: situation.code,
          reason: situation.reason,
        });
      }
    },
  );
  it.each([
    new Error("private storage key"),
    new ORPCError("FORBIDDEN", {
      message: "private",
      data: { reason: "SESSION_REQUIRED" },
    }),
    new ORPCError("BAD_REQUEST", {
      status: 500,
      message: "private",
      data: { reason: "INVALID_INPUT" },
    }),
  ])("unknown/malformed errors use safe operation failure", async (error) => {
    mocks.download.mockRejectedValue(error);
    mocks.upload.mockRejectedValue(error);
    await expectSituation(await GET(new Request(url)), "proofDownloadFailed");
    await expectSituation(await POST(multipart()), "proofUploadFailed");
  });
  it("missing session is401 before feature calls", async () => {
    mocks.session.mockResolvedValue(null);
    await expectSituation(await GET(new Request(url)), "unauthenticated");
    await expectSituation(await POST(multipart()), "unauthenticated");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("session lookup failures receive a safe response", async () => {
    mocks.session.mockRejectedValue(new Error("private auth config"));
    await expectSituation(await GET(new Request(url)), "proofDownloadFailed");
    await expectSituation(await POST(multipart()), "proofUploadFailed");
  });
  it("returns201 and only the document on success", async () => {
    const response = await POST(multipart());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "proof" });
    expect(mocks.upload).toHaveBeenCalledWith({
      partnershipId: "own",
      file: expect.any(File),
      actorId: "actor",
      activeOrganizationId: "partner",
    });
  });
  it("download preserves exact bytes, private headers and filename encoding", async () => {
    mocks.download.mockResolvedValue({
      bytes: Buffer.from([0, 255, 1]),
      fileName: "x'\r\nsecret.pdf",
      mediaType: "text/html",
    });
    const response = await GET(
      new Request(`${url}?partnershipId=own&documentId=proof`),
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from([0, 255, 1]),
    );
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename*=UTF-8''x%27%0D%0Asecret.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.download).toHaveBeenCalledWith({
      partnershipId: "own",
      documentId: "proof",
      actorId: "actor",
      activeOrganizationId: "partner",
    });
  });
});
describe("Proof upload transport gates", () => {
  it.each([undefined, "https://foreign.example", "http://localhost:1234"])(
    "rejects missing/foreign origin %s before session lookup",
    async (origin) => {
      await expectSituation(
        await POST(
          new Request(url, { method: "POST", headers: origin ? { origin } : {} }),
        ),
        "proofOriginDenied",
      );
      expect(mocks.session).not.toHaveBeenCalled();
      expect(mocks.upload).not.toHaveBeenCalled();
    },
  );
  it("rejects declared bytes above11 MB before reading", async () => {
    await expectSituation(
      await POST(
        new Request(url, {
          method: "POST",
          headers: {
            origin: "http://localhost",
            "content-length": String(11 * 1024 * 1024 + 1),
          },
        }),
      ),
      "proofTransportTooLarge",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("caps streamed bytes even with a forged Content-Length and cancels", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(11 * 1024 * 1024 + 1));
      },
      cancel,
    });
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "http://localhost", "content-length": "1" },
      body,
      duplex: "half",
    } as RequestInit);
    await expectSituation(await POST(request), "proofTransportTooLarge");
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("the exact11 MB transport boundary reaches parsing, not413", async () => {
    const request = new Request(url, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-length": String(11 * 1024 * 1024),
        "content-type": "application/octet-stream",
      },
      body: new Uint8Array(11 * 1024 * 1024),
    });
    await expectSituation(await POST(request), "proofMultipartInvalid");
  });
  it.each([undefined, "malformed multipart"])(
    "rejects absent or malformed multipart body %s",
    async (body) => {
      await expectSituation(
        await POST(
          new Request(url, {
            method: "POST",
            headers: {
              origin: "http://localhost",
              "content-type": "multipart/form-data; boundary=invalid",
            },
            body,
          }),
        ),
        "proofMultipartInvalid",
      );
      expect(mocks.upload).not.toHaveBeenCalled();
    },
  );
  it("rejects a missing file or Partnership", async () => {
    const form = new FormData();
    form.set("file", "not a file");
    await expectSituation(
      await POST(
        new Request(url, {
          method: "POST",
          headers: { origin: "http://localhost" },
          body: form,
        }),
      ),
      "proofSelectionRequired",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
