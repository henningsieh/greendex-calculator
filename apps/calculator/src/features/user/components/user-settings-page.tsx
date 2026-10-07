import { getTranslations } from "@greendex/i18n/server";
import { UserCogIcon } from "lucide-react";

import { ContentContainer } from "@/components/content-container";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageHeader } from "@/components/page-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * User Settings Page Component
 *
 * Provides a professional settings interface for user preferences including:
 * - Theme selection (light/dark/system)
 * - Language/locale selection
 *
 * Uses PageHeader and ContentContainer for consistent layout across the application.
 * Mobile responsive with proper spacing and card-based sections.
 */
export async function UserSettingsPage() {
  const t = await getTranslations("app");

  return (
    <div className="flex size-full flex-col">
      <PageHeader
        icon={<UserCogIcon />}
        title={t("userSettings.title")}
        description={t("userSettings.description")}
      />

      <ContentContainer width="lg" className="py-8">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between *:lg:gap-10">
          {/* Appearance Section */}
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>
                <h2 className="text-2xl font-bold tracking-tight">
                  {t("appearance.title")}
                </h2>
              </CardTitle>
              <CardDescription>{t("appearance.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">
                    {t("appearance.theme")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("appearance.themeDescription")}
                  </p>
                </div>
                <ThemeSwitcher className="w-22 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Language & Region Section */}
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>
                <h2 className="text-2xl font-bold tracking-tight">
                  {t("userSettings.language.title")}
                </h2>
              </CardTitle>
              <CardDescription>
                {t("userSettings.language.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">
                    {t("userSettings.language.locale")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("userSettings.language.localeDescription")}
                  </p>
                </div>
                <LocaleSwitcher className="w-22 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      </ContentContainer>
    </div>
  );
}
