/**
 * @file User settings page
 *
 * language settings and the theme setting for the authenticated user
 */

import { UserSettingsPage } from "@/features/user/components/user-settings-page";
import type { LocaleParams } from "@/lib/i18n/types";

// See apps/calculator/docs/README.md#instant-navigation-opt-outs.
export const instant = false;

/**
 * Render language and theme preferences using the route locale.
 */
export default async function UserSettings({
  params,
}: {
  params: Promise<LocaleParams>;
}) {
  const { locale } = await params;
  return <UserSettingsPage locale={locale} />;
}
