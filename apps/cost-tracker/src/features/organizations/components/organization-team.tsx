"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { parseOrganizationRoles } from "@greendex/auth/permissions";
import { useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

const STAFF_ROLES = [
  ORGANIZATION_ROLES.OrganizationOwner,
  ORGANIZATION_ROLES.OrganizationAdmin,
] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const membersOptions = {
  ...orpcQuery.organizations.listMembers.queryOptions({
    input: {},
    meta: { costTrackerORPC: true },
  }),
};

const pendingOptions = {
  ...orpcQuery.organizations.listPendingInvitations.queryOptions({
    input: {},
    meta: { costTrackerORPC: true },
  }),
};

function roleBadges(role: string) {
  return parseOrganizationRoles(role).map((entry) => (
    <Badge
      key={entry}
      variant="secondary"
      data-testid={`staff-role-${entry}`}
      data-role={entry}
    >
      {entry}
    </Badge>
  ));
}

export function OrganizationTeam({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("organizations.confirmations");
  const tTeam = useTranslations("organizations.team");
  const tCommon = useTranslations("common");
  const { confirm, dialog } = useConfirmDialog();
  const [members, pending] = useSuspenseQueries({
    queries: [membersOptions, pendingOptions],
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>(
    ORGANIZATION_ROLES.OrganizationAdmin,
  );
  const [formError, setFormError] = useState("");
  const [pendingInvitationIds, setPendingInvitationIds] = useState(
    () => new Set<string>(),
  );

  const memberRows = members.data.members;
  const invitationRows = pending.data.invitations;
  const ownRole =
    memberRows.find(
      (entry) => entry.email.toLowerCase() === currentUserEmail.toLowerCase(),
    )?.role ?? "";
  const ownIsOwner = parseOrganizationRoles(ownRole).includes(
    ORGANIZATION_ROLES.OrganizationOwner,
  );
  // Presentation-only: the invite procedure denies above-role grants.
  const availableRoles = ownIsOwner
    ? STAFF_ROLES
    : STAFF_ROLES.filter(
        (entry) => entry !== ORGANIZATION_ROLES.OrganizationOwner,
      );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: membersOptions.queryKey }),
      queryClient.invalidateQueries({ queryKey: pendingOptions.queryKey }),
    ]);
  }

  const invite = useMutation({
    mutationFn: (input: { email: string; role: StaffRole }) =>
      orpc.organizations.inviteMember(input),
    onSuccess: async (result) => {
      setEmail("");
      setRole(ORGANIZATION_ROLES.OrganizationAdmin);
      setFormError("");
      toast.add({
        title: tTeam("invitationSent", { email: result.email }),
        type: "success",
      });
      await refresh();
    },
    onError: (error) => {
      setFormError(getORPCRequestErrorMessage(error).text);
    },
  });

  const cancel = useMutation({
    mutationFn: (invitationId: string) =>
      orpc.organizations.cancelInvitation({ invitationId }),
    onSuccess: async () => {
      setFormError("");
      toast.add({ title: tTeam("invitationCancelled"), type: "success" });
      await refresh();
    },
    onError: (error) => {
      setFormError(getORPCRequestErrorMessage(error).text);
    },
    onSettled: (_data, _error, invitationId) => {
      setPendingInvitationIds((current) => {
        const next = new Set(current);
        next.delete(invitationId);
        return next;
      });
    },
  });

  function sendInvite(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate({ email, role });
  }

  const error = formError;

  return (
    <div className="space-y-10">
      {dialog}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{tTeam("unavailable")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card data-testid="staff-members">
        <CardHeader>
          <CardTitle>{tTeam("membersTitle")}</CardTitle>
          <CardDescription>{tTeam("membersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("name")}</TableHead>
                <TableHead>{tCommon("email")}</TableHead>
                <TableHead>{tCommon("roles")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberRows.map((entry) => (
                <TableRow key={entry.id} data-testid={`staff-member-${entry.id}`}>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {roleBadges(entry.role)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {memberRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>{tTeam("noMembers")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="staff-invite">
        <CardHeader>
          <CardTitle>{tTeam("inviteTitle")}</CardTitle>
          <CardDescription>{tTeam("inviteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={sendInvite}>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="staff-invite-email">{tCommon("email")}</Label>
              <Input
                id="staff-invite-email"
                data-testid="staff-invite-email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="staff-invite-role">{tCommon("role")}</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as StaffRole)}
              >
                <SelectTrigger id="staff-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end sm:col-span-1">
              <Button
                data-testid="send-staff-invitation"
                disabled={invite.isPending || !email}
                type="submit"
              >
                {invite.isPending ? tTeam("sending") : tTeam("sendInvitation")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tTeam("pendingTitle")}</CardTitle>
          <CardDescription>{tTeam("pendingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("email")}</TableHead>
                <TableHead>{tCommon("role")}</TableHead>
                <TableHead>
                  <span className="sr-only">{tCommon("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitationRows.map((entry) => (
                <TableRow
                  key={entry.id}
                  data-testid={`staff-invitation-${entry.id}`}
                >
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.role ?? tTeam("noRole")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      data-testid={`cancel-staff-invitation-${entry.id}`}
                      disabled={pendingInvitationIds.has(entry.id)}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: t("cancelInvitation.title"),
                            description: t("cancelInvitation.description", {
                              email: entry.email,
                            }),
                            confirmText: t("cancelInvitation.execute"),
                            isDestructive: true,
                          })
                        ) {
                          setPendingInvitationIds((current) =>
                            new Set(current).add(entry.id),
                          );
                          cancel.mutate(entry.id);
                        }
                      }}
                      type="button"
                      variant="outline"
                    >
                      {pendingInvitationIds.has(entry.id)
                        ? t("pending")
                        : tTeam("cancel")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invitationRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>{tTeam("noPending")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
