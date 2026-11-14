import { getTranslations } from "@greendex/i18n/server";
import { Link2Icon, MailPlusIcon, UserCheckIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A static three-step explainer for the Partner Organizations page.
 * The steps are a true sequence (invite, join, collaborate), so the ordered
 * list carries meaning rather than decoration.
 */
export async function PartnerNetworkGuide() {
  const t = await getTranslations("partnerships.partnerOrganizations.guide");
  const steps = [
    { icon: MailPlusIcon, title: t("inviteTitle"), text: t("inviteText") },
    { icon: UserCheckIcon, title: t("joinTitle"), text: t("joinText") },
    {
      icon: Link2Icon,
      title: t("collaborateTitle"),
      text: t("collaborateText"),
    },
  ];

  return (
    <section aria-label={t("title")} className="mt-10">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li className="flex gap-4" key={step.title}>
                <span
                  aria-hidden="true"
                  className="font-heading text-3xl font-extrabold text-primary"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <step.icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    {step.title}
                  </p>
                  <p className="text-sm/relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
