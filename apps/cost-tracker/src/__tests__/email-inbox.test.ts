// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- App-local live-check scripts sit outside the src alias. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capabilities: new Map<string, boolean>([["UIDPLUS", true]]),
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  search: vi.fn(),
  fetchOne: vi.fn(),
  messageDelete: vi.fn(),
  logout: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    capabilities = mocks.capabilities;
    connect = mocks.connect;
    mailboxOpen = mocks.mailboxOpen;
    search = mocks.search;
    fetchOne = mocks.fetchOne;
    messageDelete = mocks.messageDelete;
    logout = mocks.logout;
  },
}));
vi.mock("postal-mime", () => ({ default: { parse: mocks.parse } }));
import { EmailInbox } from "../../scripts/email-inbox";

const environment = {
  SMTP_SENDER: "dedicated@example.test",
  EMAIL_TEST_RECIPIENT: "dedicated@example.test",
};
const base = "http://127.0.0.1:1234";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.capabilities.set("UIDPLUS", true);
  mocks.mailboxOpen.mockResolvedValue({ uidNext: 10, uidValidity: BigInt(1) });
  mocks.search.mockResolvedValue([9, 10, 11]);
  mocks.fetchOne.mockImplementation(async (uid: string) => ({
    source: Buffer.from(uid),
  }));
  mocks.parse.mockImplementation(async (source: Buffer) => ({
    subject: "workflow",
    from: { address: environment.SMTP_SENDER },
    to: [{ address: environment.EMAIL_TEST_RECIPIENT }],
    html: `<a href="${base}/verify?run=${source.toString() === "11" ? "current" : "old"}">Verify</a>`,
  }));
  mocks.messageDelete.mockResolvedValue(true);
});
async function receive(inbox: EmailInbox) {
  await inbox.connect();
  const boundary = await inbox.boundary();
  return inbox.deliveredLink(
    boundary,
    "workflow",
    base,
    "/verify",
    (url) => url.searchParams.get("run") === "current",
  );
}
describe("email-inbox", () => {
  it("ignores retained old UIDs and unrelated current messages, retaining by default", async () => {
    const inbox = new EmailInbox(environment);
    expect(await receive(inbox)).toContain("run=current");
    expect(mocks.fetchOne).not.toHaveBeenCalledWith(
      "9",
      expect.anything(),
      expect.anything(),
    );
    expect(await inbox.cleanup()).toEqual({ retained: 1, deleted: 0 });
    expect(mocks.messageDelete).not.toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
  it("deletes and verifies only proven run-owned UIDs when opted in", async () => {
    const inbox = new EmailInbox({
      ...environment,
      DELETE_TESTMAILS_DURING_TESTRUN: "true",
    });
    await receive(inbox);
    mocks.fetchOne.mockResolvedValue(false);
    expect(await inbox.cleanup()).toEqual({ retained: 0, deleted: 1 });
    expect(mocks.messageDelete).toHaveBeenCalledExactlyOnceWith("11", {
      uid: true,
    });
    expect(mocks.fetchOne).toHaveBeenLastCalledWith(
      "11",
      { uid: true },
      { uid: true },
    );
  });
  it("refuses destructive fallback without UIDPLUS", async () => {
    const inbox = new EmailInbox({
      ...environment,
      DELETE_TESTMAILS_DURING_TESTRUN: "true",
    });
    await receive(inbox);
    mocks.capabilities.clear();
    await expect(inbox.cleanup()).rejects.toThrow();
    expect(mocks.messageDelete).not.toHaveBeenCalled();
  });
  it("fails cleanup instead of claiming a deletion that did not remove a message", async () => {
    const inbox = new EmailInbox({
      ...environment,
      DELETE_TESTMAILS_DURING_TESTRUN: "true",
    });
    await receive(inbox);
    await expect(inbox.cleanup()).rejects.toThrow();
  });
  it("refuses changed mailbox identity before deleting", async () => {
    const inbox = new EmailInbox({
      ...environment,
      DELETE_TESTMAILS_DURING_TESTRUN: "true",
    });
    await receive(inbox);
    mocks.mailboxOpen.mockResolvedValue({ uidNext: 10, uidValidity: BigInt(2) });
    await expect(inbox.cleanup()).rejects.toThrow();
    expect(mocks.messageDelete).not.toHaveBeenCalled();
  });
});
