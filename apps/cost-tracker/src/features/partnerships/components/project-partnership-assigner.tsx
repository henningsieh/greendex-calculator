"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

import { EntityCombobox } from "@/components/entity-combobox";
import { ErrorPresentation } from "@/components/error-presentation/error-presentation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc/orpc";

import { invalidatePartnershipProjectData } from "./invalidate-partnership-data";

const searchHosted = (search: string) => orpc.projects.searchHosted({ search });
const searchOrganizations = (search: string) =>
  orpc.organizations.search({ search });

/**
 * Assign-an-existing-Organization dialog. The pickers search on demand, so
 * the dialog issues no assign-only queries by itself, and the trigger below
 * only renders for viewers who may assign — readers never fetch what they
 * cannot use.
 */
export function AssignOrganizationDialog() {
  const queryClient = useQueryClient();
  const t = useTranslations("partnerships");
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState<React.ReactNode>(null);

  const assignMutation = useMutation({
    mutationFn: () =>
      orpc.projectPartnerships.assign({ projectId, organizationId }),
    onSuccess: async () => {
      await invalidatePartnershipProjectData(queryClient);
      setOpen(false);
      setProjectId("");
      setOrganizationId("");
      setError(null);
    },
    onError: (cause) => {
      setError(<ErrorPresentation error={cause} />);
    },
  });

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
      open={open}
    >
      <DialogTrigger
        data-testid="assign-organization"
        render={<Button type="button" />}
      >
        {t("manager.assignExisting")}
      </DialogTrigger>
      <DialogContent
        data-testid="organization-assignment"
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("manager.assignExisting")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            assignMutation.mutate();
          }}
        >
          <div data-testid="hosted-project-picker" className="grid gap-2">
            <span className="text-sm font-medium">
              {t("manager.hostedProject")}
            </span>
            <EntityCombobox
              label={t("manager.hostedProject")}
              value={projectId}
              onChange={setProjectId}
              search={searchHosted}
            />
          </div>
          <div data-testid="partner-organization-picker" className="grid gap-2">
            <span className="text-sm font-medium">
              {t("manager.partnerOrganization")}
            </span>
            <EntityCombobox
              label={t("manager.partnerOrganization")}
              value={organizationId}
              onChange={setOrganizationId}
              search={searchOrganizations}
            />
          </div>
          {error && <div role="alert">{error}</div>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("manager.cancel")}
            </DialogClose>
            <Button
              data-testid="assign-partnership"
              disabled={assignMutation.isPending || !projectId || !organizationId}
              type="submit"
            >
              <LinkIcon aria-hidden="true" />
              {assignMutation.isPending
                ? t("manager.assigning")
                : t("manager.assign")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
