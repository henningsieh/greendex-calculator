import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node
import { getErrorStatus } from "@/lib/orpc/error-status";

const mocks = vi.hoisted(() => ({
  scope: vi.fn(),
  limit: vi.fn(),
  returning: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  session: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/proof-storage", () => ({
  putProofFile: mocks.put,
  getProofFile: mocks.get,
}));
vi.mock("@/features/projects/procedures/coordination", async () => {
  const { z } = await import("zod");
  return {
    coordinationId: z.string().min(1).max(128),
    requirePartnerCoordination: mocks.scope,
  };
});
vi.mock("@greendex/database", () => {
  const query = {
    from: () => query,
    where: () => query,
    innerJoin: () => query,
    for: () => query,
    limit: mocks.limit,
  };
  const executor = {
    select: () => query,
    insert: () => ({ values: () => ({ returning: mocks.returning }) }),
  };
  return {
    db: {
      ...executor,
      transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(executor),
    },
  };
});
import {
  downloadProofDocument,
  uploadProofDocument,
  list,
} from "@/features/projects/procedures/documents";
import { createSituationErrors } from "@/lib/orpc/errors";

const input = {
  partnershipId: "own",
  actorId: "actor",
  activeOrganizationId: "partner",
};
const file = () =>
  new File([new Uint8Array([1, 2, 3])], "receipt.pdf", {
    type: "application/pdf",
  });
const errors = createSituationErrors();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope.mockResolvedValue({ partnerId: "partner", hostId: "host" });
  mocks.session.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "partner" },
  });
  mocks.limit.mockResolvedValue([{ id: "claim", status: "editable" }]);
  mocks.returning.mockResolvedValue([{ id: "proof" }]);
  mocks.get.mockResolvedValue(Buffer.from([1, 2, 3]));
});
describe("Proof Document upload outcomes", () => {
  it.each([
    [
      "invalid Partnership",
      () => ({ ...input, partnershipId: "", file: file() }),
      "BAD_REQUEST",
      400,
      "PROOF_SELECTION_REQUIRED",
      "Select a file and Project Partnership.",
    ],
    [
      "missing file",
      () => ({ ...input, file: null as unknown as File }),
      "BAD_REQUEST",
      400,
      "PROOF_SELECTION_REQUIRED",
      "Select a file and Project Partnership.",
    ],
    [
      "unsupported media",
      () => ({
        ...input,
        file: new File(["x"], "x.txt", { type: "text/plain" }),
      }),
      "UNSUPPORTED_MEDIA_TYPE",
      415,
      "PROOF_MEDIA_UNSUPPORTED",
      "Choose a PDF, JPEG, or PNG Proof Document.",
    ],
    [
      "empty file",
      () => ({
        ...input,
        file: new File([], "x.pdf", { type: "application/pdf" }),
      }),
      "BAD_REQUEST",
      400,
      "PROOF_FILE_EMPTY",
      "Choose a non-empty Proof Document.",
    ],
    [
      "oversized file",
      () => ({
        ...input,
        file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "x.pdf", {
          type: "application/pdf",
        }),
      }),
      "PAYLOAD_TOO_LARGE",
      413,
      "PROOF_FILE_TOO_LARGE",
      "Choose a Proof Document no larger than 10 MB.",
    ],
    [
      "missing name",
      () => ({
        ...input,
        file: new File(["x"], " ", { type: "application/pdf" }),
      }),
      "BAD_REQUEST",
      400,
      "PROOF_FILE_NAME_REQUIRED",
      "Choose a Proof Document with a file name.",
    ],
  ] as const)("%s", async (_name, makeInput, code, status, reason, message) => {
    expect(getErrorStatus(code)).toBe(status);
    await expect(uploadProofDocument(makeInput())).rejects.toMatchObject({
      code,
      message,
      data: { reason },
    });
    expect(mocks.scope).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it.each([
    [
      [],
      "CLAIM_REQUIRED_FOR_PROOF",
      "Save an editable Claim before uploading a Proof Document.",
    ],
    [
      [{ id: "claim", status: "submitted" }],
      "CLAIM_NOT_EDITABLE",
      "Claim is not editable.",
    ],
  ])(
    "distinguishes missing and locked Claim: %j",
    async (claims, reason, message) => {
      mocks.limit.mockResolvedValue(claims);
      await expect(
        uploadProofDocument({ ...input, file: file() }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message,
        data: { reason },
      });
      expect(mocks.put).not.toHaveBeenCalled();
    },
  );
  it("denies Hosting-side upload and list with accurate scope copy", async () => {
    mocks.scope.mockResolvedValue({ partnerId: "other", hostId: "partner" });
    const expected = {
      code: "FORBIDDEN",
      message: "Only the Partner Organization may manage Proof Documents.",
      data: { reason: "PARTNER_DOCUMENTS_REQUIRED" },
    };
    await expect(
      uploadProofDocument({ ...input, file: file() }),
    ).rejects.toMatchObject(expected);
    const client = createRouterClient(
      { list },
      { context: { headers: new Headers() } },
    );
    await expect(client.list({ partnershipId: "own" })).rejects.toMatchObject(
      expected,
    );
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it.each(["application/pdf", "image/jpeg", "image/png"])(
    "preserves %s bytes and accepts the exact 10 MB boundary",
    async (type) => {
      const bytes = new Uint8Array(10 * 1024 * 1024);
      bytes[0] = 7;
      expect(
        await uploadProofDocument({
          ...input,
          file: new File([bytes], "receipt", { type }),
        }),
      ).toEqual({ status: 201, document: { id: "proof" } });
      expect(mocks.put).toHaveBeenCalledOnce();
      const [reference, storedBytes, mediaType] = mocks.put.mock.calls[0];
      expect(reference).toMatch(/^claims\/partner\/claim\//);
      expect(mediaType).toBe(type);
      expect(Buffer.isBuffer(storedBytes)).toBe(true);
      expect(storedBytes.length).toBe(bytes.length);
      expect(storedBytes.equals(Buffer.from(bytes))).toBe(true);
    },
  );
});
describe("Proof Document download scope", () => {
  it.each(["", "x".repeat(129)])(
    "invalid identifier is404 without looking up a document",
    async (documentId) => {
      await expect(
        downloadProofDocument({ ...input, documentId }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Proof Document not found in scope.",
        data: { reason: "PROOF_DOCUMENT_NOT_FOUND" },
      });
      expect(mocks.scope).not.toHaveBeenCalled();
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it("missing/foreign scoped document is404 after authorization", async () => {
    mocks.limit.mockResolvedValue([]);
    await expect(
      downloadProofDocument({ ...input, documentId: "foreign" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PROOF_DOCUMENT_NOT_FOUND" },
    });
    expect(mocks.scope).toHaveBeenCalledWith("own", "actor", "partner", {});
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("retains Hosting oversight download and stored bytes", async () => {
    mocks.scope.mockResolvedValue({ partnerId: "other", hostId: "partner" });
    mocks.limit.mockResolvedValue([
      {
        fileReference: "private-reference",
        originalFileName: "receipt.pdf",
        mediaType: "application/pdf",
      },
    ]);
    expect(
      await downloadProofDocument({ ...input, documentId: "proof" }),
    ).toEqual({
      bytes: Buffer.from([1, 2, 3]),
      fileName: "receipt.pdf",
      mediaType: "application/pdf",
    });
  });
  it.each([
    errors.selectOrganization(),
    errors.notMember(),
    errors.partnershipNotFound(),
    errors.partnerCoordinationRequired(),
  ])("preserves shared semantic denial $code/$data.reason", async (error) => {
    mocks.scope.mockRejectedValue(error);
    await expect(
      downloadProofDocument({ ...input, documentId: "proof" }),
    ).rejects.toBe(error);
    await expect(uploadProofDocument({ ...input, file: file() })).rejects.toBe(
      error,
    );
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
