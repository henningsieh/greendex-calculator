"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQueries } from "@tanstack/react-query";
import { ChevronDownIcon, LinkIcon, MailPlusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssignOrganizationDialog } from "@/features/partnerships/components/project-partnership-assigner";
import { CreateSetupLinkDialog } from "@/features/partnerships/components/setup-link";
import { orpcQuery } from "@/lib/orpc/orpc";

/**
 * Partnership actions menu: one menu button carrying both setup dialogs.
 * The trigger keeps the primary call to action ("Partner einladen" with a
 * chevron); the menu lists both flows as non-wrapping options. One control
 * replaces the former button-plus-overflow pair, so the two look-alike
 * triggers never compete again.
 *
 * The labels carry the interaction language: "…" marks dialog openers
 * (input dialogs, not confirmations), "→" on links marks navigation.
 */
export function PartnershipActions({
  projectId,
  organizationId,
  tone = "primary",
}: {
  /** Preselects the Hosted Project (and locks it) for both dialogs. */
  projectId?: string;
  /** Preselects the Partner Organization (and locks it) for assignment. */
  organizationId?: string;
  /** Secondary card contexts use the compact outline trigger. */
  tone?: "primary" | "secondary";
} = {}) {
  const t = useTranslations("partnerships");
  const [projects, organizations] = useSuspenseQueries({
    queries: [
      orpcQuery.projects.listHostedOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
      orpcQuery.organizations.listOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    ],
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const small = tone === "secondary";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              data-testid="partnership-actions-menu"
              size={small ? "xs" : "default"}
              type="button"
              variant={small ? "outline" : "default"}
            />
          }
        >
          <PlusIcon aria-hidden="true" />
          {t("setup.addPartner")}
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        {/* max-content width: both options stay on one line each. */}
        <DropdownMenuContent align="end" className="w-max">
          <DropdownMenuItem
            data-testid="new-setup-link"
            onClick={() => setInviteOpen(true)}
          >
            <MailPlusIcon aria-hidden="true" />
            {t("setup.invitePartner")}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="assign-organization"
            onClick={() => setAssignOpen(true)}
          >
            <LinkIcon aria-hidden="true" />
            {t("setup.assignPartner")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateSetupLinkDialog
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        projectId={projectId}
        projects={projects.data}
        showTrigger={false}
      />
      <AssignOrganizationDialog
        onOpenChange={setAssignOpen}
        open={assignOpen}
        organizationId={organizationId}
        projectId={projectId}
        projects={projects.data}
        organizations={organizations.data}
        showTrigger={false}
      />
    </>
  );
}

/**
 * Inline partnership shortcuts for empty states: two prose-styled links
 * ("… Neuen Partner einladen oder bestehenden Partner zuweisen") that open
 * the Invite and Assign dialogs in place instead of navigating away. Used
 * where buttons would overpower an otherwise quiet empty state.
 */
export function PartnershipShortcutLinks({
  projectId,
}: {
  /** Preselects the Hosted Project (and locks it) for both dialogs. */
  projectId?: string;
} = {}) {
  const t = useTranslations("partnerships");
  const [projects, organizations] = useSuspenseQueries({
    queries: [
      orpcQuery.projects.listHostedOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
      orpcQuery.organizations.listOptions.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    ],
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <>
      <button
        className="font-medium underline decoration-brand underline-offset-4 hover:decoration-2"
        data-testid="invite-partnership-link"
        onClick={() => setInviteOpen(true)}
        type="button"
      >
        {t("setup.invitePartner")}
      </button>{" "}
      {t("setup.orSeparator")}{" "}
      <button
        className="font-medium underline decoration-brand underline-offset-4 hover:decoration-2"
        data-testid="assign-partnership-link"
        onClick={() => setAssignOpen(true)}
        type="button"
      >
        {t("setup.assignPartner")}
      </button>
      <CreateSetupLinkDialog
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        projectId={projectId}
        projects={projects.data}
        showTrigger={false}
      />
      <AssignOrganizationDialog
        onOpenChange={setAssignOpen}
        open={assignOpen}
        projectId={projectId}
        projects={projects.data}
        organizations={organizations.data}
        showTrigger={false}
      />
    </>
  );
}
