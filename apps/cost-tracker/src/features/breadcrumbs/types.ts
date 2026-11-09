import type { getTranslations } from "@greendex/i18n/server";

type ShellTranslator = Awaited<ReturnType<typeof getTranslations<"shell">>>;

/**
 * A message key under the shared `shell` namespace.
 *
 * Breadcrumb slots take a label key instead of a resolved string, so a renamed
 * or deleted message is a compile error rather than an empty crumb. Labels come
 * from `nav.*` for the leaf pages of the primary navigation and from `crumbs.*`
 * for nested pages.
 */
export type ShellMessageKey = Parameters<ShellTranslator>[0];
