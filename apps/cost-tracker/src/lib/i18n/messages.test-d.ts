import type { useTranslations } from "@greendex/i18n/client";
import type { getTranslations } from "@greendex/i18n/server";
import { expectTypeOf } from "vitest";

type ClientTranslator = ReturnType<typeof useTranslations<"apiErrors">>;
type ServerTranslator = Awaited<ReturnType<typeof getTranslations<"apiErrors">>>;

const clientCopy = (t: ClientTranslator) => [
  t("SESSION_REQUIRED"),
  t("fallback.internalFailure"),
];
const serverCopy = (t: ServerTranslator) => [
  t("SESSION_REQUIRED"),
  t("fallback.networkFailure"),
];

expectTypeOf(clientCopy).returns.toEqualTypeOf<string[]>();
expectTypeOf(serverCopy).returns.toEqualTypeOf<string[]>();
expectTypeOf<ClientTranslator>().toEqualTypeOf<ServerTranslator>();
