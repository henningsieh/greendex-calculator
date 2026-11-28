"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  SectionTabs,
  SectionTabsContent,
  SectionTabsList,
  SectionTabsTrigger,
  SectionTabsWrapper,
} from "@/components/section-tabs";

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
    <SectionTabsWrapper>
      <SectionTabs
        data-testid="partner-organizations-tabs"
        defaultValue="partnerships"
      >
        <SectionTabsList aria-label={t("label")}>
          <SectionTabsTrigger
            data-testid="partner-organizations-tab-partnerships"
            value="partnerships"
          >
            {t("partnerships")}
          </SectionTabsTrigger>
          <SectionTabsTrigger
            data-testid="partner-organizations-tab-invitations"
            value="invitations"
          >
            {t("invitations")}
          </SectionTabsTrigger>
        </SectionTabsList>
        <SectionTabsContent value="partnerships">
          {partnerships}
        </SectionTabsContent>
        <SectionTabsContent value="invitations">{invitations}</SectionTabsContent>
      </SectionTabs>
    </SectionTabsWrapper>
  );
}
