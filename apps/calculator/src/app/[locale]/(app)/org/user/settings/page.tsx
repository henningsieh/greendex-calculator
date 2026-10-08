/**
 * @file User settings page
 *
 * language settings and the theme setting for the authenticated user
 */

import { UserSettingsPage } from "@/features/user/components/user-settings-page";

// instant = false: kept on purpose — session-gated page under the blocking
// (app) gate rendering the preferences form for the signed-in user;
// streaming it is a deliberate follow-up (#246).
export const instant = false;

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
