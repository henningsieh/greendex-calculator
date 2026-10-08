/**
 * @file Settings page
 *
 * Organization settings page with edit organization form
 */

import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import { ContentContainer } from "@/components/content-container";
import { PageHeader } from "@/components/page-header";
import {
  EditOrganizationForm,
  EditOrganizationFormSkeleton,
} from "@/features/organizations/components/edit-organization-form";
import { ORGANIZATION_ICONS } from "@/features/organizations/organization-icons";

// instant = false: kept on purpose — session-gated page rendering the
// organization edit form for the active organization (#246).
export const instant = false;

export default async function SettingsPage() {
  const t = await getTranslations("organization.settings");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<ORGANIZATION_ICONS.settings />}
        title={t("title")}
        description={t("description")}
      />
      <ContentContainer width="sm">
        <Suspense fallback={<EditOrganizationFormSkeleton />}>
          <EditOrganizationForm />
        </Suspense>
      </ContentContainer>
    </div>
  );
}
