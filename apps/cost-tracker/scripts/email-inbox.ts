import { setTimeout as delay } from "node:timers/promises";

import { ImapFlow } from "imapflow";
import PostalMime from "postal-mime";

import { deletionEnabled, selectDeliveredLink } from "./email-run-safety";

/** UID boundary + application-issued identity: retained old mail is never evidence. */
export class EmailInbox {
  private client: ImapFlow;
  private provenUids = new Set<number>();
  private validity = "";
  private connected = false;
  constructor(private environment: Record<string, string>) {
    this.client = new ImapFlow({
      host: environment.IMAP_HOST,
      port: Number(environment.IMAP_PORT),
      secure: true,
      auth: { user: environment.IMAP_USERNAME, pass: environment.IMAP_PASSWORD },
      logger: false,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    });
  }
  async connect(): Promise<void> {
    await this.client.connect();
    this.connected = true;
    const mailbox = await this.client.mailboxOpen("INBOX");
    this.validity = String(mailbox.uidValidity);
  }
  async boundary(): Promise<number> {
    const mailbox = await this.client.mailboxOpen("INBOX");
    if (String(mailbox.uidValidity) !== this.validity)
      throw new Error("Mailbox identity changed during run.");
    return mailbox.uidNext;
  }
  async deliveredLink(
    boundary: number,
    subject: string,
    base: string,
    path: string,
    belongsToWorkflow: (link: URL, html: string) => boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      await this.boundary();
      const uids = await this.client.search(
        { uid: `${boundary}:*`, subject },
        { uid: true },
      );
      for (const uid of uids || []) {
        // IMAP reversed ranges can include the previous last UID when no new mail exists.
        if (uid < boundary) continue;
        const message = await this.client.fetchOne(
          String(uid),
          { source: true },
          { uid: true },
        );
        if (!message || !message.source) continue;
        const parsed = await PostalMime.parse(message.source);
        if (
          parsed.subject !== subject ||
          parsed.from?.address !== this.environment.SMTP_SENDER
        )
          continue;
        if (
          parsed.to?.length !== 1 ||
          !("address" in parsed.to[0]) ||
          parsed.to[0].address !== this.environment.EMAIL_TEST_RECIPIENT
        )
          continue;
        const html = parsed.html || "";
        let link: string;
        try {
          link = selectDeliveredLink(html, base, path);
        } catch {
          continue;
        }
        if (!belongsToWorkflow(new URL(link), html)) continue;
        signal?.throwIfAborted();
        this.provenUids.add(uid);
        return link;
      }
      await delay(2_000, undefined, { signal });
    }
    throw new Error("Current workflow email receipt timed out.");
  }
  async cleanup(): Promise<{ retained: number; deleted: number }> {
    try {
      if (
        deletionEnabled(this.environment.DELETE_TESTMAILS_DURING_TESTRUN) &&
        this.provenUids.size
      ) {
        await this.boundary();
        // Without UID EXPUNGE, IMAP can expunge unrelated already-deleted mail.
        if (!this.client.capabilities.has("UIDPLUS"))
          throw new Error("Run-only deletion requires UIDPLUS.");
        for (const uid of this.provenUids) {
          if (!(await this.client.messageDelete(String(uid), { uid: true })))
            throw new Error("Run message deletion failed.");
          const remaining = await this.client.fetchOne(
            String(uid),
            { uid: true },
            { uid: true },
          );
          if (remaining) throw new Error("Deleted run message is still present.");
        }
        return { retained: 0, deleted: this.provenUids.size };
      }
      return { retained: this.provenUids.size, deleted: 0 };
    } finally {
      if (this.connected) await this.client.logout();
    }
  }
}
