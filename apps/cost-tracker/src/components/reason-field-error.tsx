"use client";

import { useTranslations } from "@greendex/i18n/client";

export function ReasonFieldError() {
  const t = useTranslations("common.confirmDialog");
  return <>{t("reasonInvalid")}</>;
}
