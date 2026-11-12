"use client";

import { useTranslations } from "@greendex/i18n/client";

export function ProjectOptionsLoading() {
  const t = useTranslations("partnerships.projectOptions");
  return <output aria-busy="true">{t("loading")}</output>;
}
