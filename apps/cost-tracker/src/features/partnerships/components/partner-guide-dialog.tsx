"use client";

import { useTranslations } from "@greendex/i18n/client";
import { InfoIcon, Link2Icon, MailPlusIcon, UserCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "How partnering works" guide dialog.
 *
 * The three steps are a true sequence (invite, join, collaborate), so the
 * ordered list carries meaning rather than decoration. Pure information —
 * hence a ghost trigger with an info icon, never a solid button that would
 * compete with the view's actions.
 */
export function PartnerGuideDialog() {
  const t = useTranslations("partnerships.partnerOrganizations.guide");
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
    <Dialog>
      <DialogTrigger
        data-testid="partner-guide-trigger"
        render={<Button type="button" variant="ghost" />}
      >
        <InfoIcon aria-hidden="true" />
        {t("dialogTrigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" data-testid="partner-guide-dialog">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <ol className="grid gap-6">
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
      </DialogContent>
    </Dialog>
  );
}
