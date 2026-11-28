import { useTranslations } from "@greendex/i18n/client";

import { protectedPages } from "@/features/breadcrumbs/breadcrumb-routes";

export function useParticipationLabel(view: "participants" | "participations") {
  const t = useTranslations("shell");
  return t(protectedPages[view].label);
}
