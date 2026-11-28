import type { MessageKeys, NestedKeyOf } from "next-intl";

import type shellMessages from "@/messages/en-GB/shell.json";

type ShellMessages = typeof shellMessages.shell;

export type ShellMessageKey = MessageKeys<
  ShellMessages,
  NestedKeyOf<ShellMessages>
>;
