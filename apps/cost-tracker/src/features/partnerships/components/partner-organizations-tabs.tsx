"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Experiment: section tabs for the Partner Organizations page.
 * Uncontrolled (defaultValue) — the tab choice is pure view state.
 */
export function PartnerOrganizationsTabs({
  partnerships,
  invitations,
  showInvitations,
}: {
  partnerships: React.ReactNode;
  invitations?: React.ReactNode;
  showInvitations: boolean;
}) {
  const t = useTranslations("partnerships.partnerOrganizations.tabs");
  if (!showInvitations) return <>{partnerships}</>;
  return (
    <Tabs
      className="mt-10"
      data-testid="partner-organizations-tabs"
      defaultValue="partnerships"
    >
      <TabsList aria-label={t("label")} variant="line">
        <TabsTrigger
          data-testid="partner-organizations-tab-partnerships"
          value="partnerships"
          variant="line"
        >
          {t("partnerships")}
        </TabsTrigger>
        <TabsTrigger
          data-testid="partner-organizations-tab-invitations"
          value="invitations"
          variant="line"
        >
          {t("invitations")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="partnerships">{partnerships}</TabsContent>
      <TabsContent value="invitations">{invitations}</TabsContent>
    </Tabs>
  );
}
