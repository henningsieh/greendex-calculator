/**
 * @file User settings page
 *
 * language settings and the theme setting for the authenticated user
 */

import { UserSettingsPage } from "@/features/user/components/user-settings-page";

export default async function UserSettings({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  return <UserSettingsPage locale={locale} />;
}
