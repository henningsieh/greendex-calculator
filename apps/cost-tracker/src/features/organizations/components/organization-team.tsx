"use client";

import { parseOrganizationRoles } from "@greendex/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";

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
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

type StaffRole = "owner" | "admin" | "member";

const STAFF_ROLES: StaffRole[] = ["owner", "admin", "member"];

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
    <Badge key={entry} variant="secondary">
      {entry}
    </Badge>
  ));
}

function queryErrorText(error: unknown): string | null {
  if (!error) return null;
  return getORPCRequestErrorMessage(error).text;
}

export function OrganizationTeam({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const queryClient = useQueryClient();
  const members = useQuery(membersOptions);
  const pending = useQuery(pendingOptions);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("member");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  const memberRows = members.data?.members ?? [];
  const invitationRows = pending.data?.invitations ?? [];
  const ownRole =
    memberRows.find(
      (entry) => entry.email.toLowerCase() === currentUserEmail.toLowerCase(),
    )?.role ?? "";
  const ownIsOwner = parseOrganizationRoles(ownRole).includes("owner");
  // Presentation-only: the invite procedure denies above-role grants.
  const availableRoles = ownIsOwner
    ? STAFF_ROLES
    : STAFF_ROLES.filter((entry) => entry !== "owner");

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
      setRole("member");
      setFormError("");
      setNotice(`Invitation sent to ${result.email}.`);
      await refresh();
    },
    onError: (error) => {
      setNotice("");
      setFormError(getORPCRequestErrorMessage(error).text);
    },
  });

  const cancel = useMutation({
    mutationFn: (invitationId: string) =>
      orpc.organizations.cancelInvitation({ invitationId }),
    onSuccess: async () => {
      setFormError("");
      setNotice("Invitation cancelled.");
      await refresh();
    },
    onError: (error) => {
      setNotice("");
      setFormError(getORPCRequestErrorMessage(error).text);
    },
  });

  function sendInvite(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate({ email, role });
  }

  const loadError =
    queryErrorText(members.error) ?? queryErrorText(pending.error);
  const error = formError || loadError;

  if (members.isPending || pending.isPending) {
    return <p>Loading Organization staff…</p>;
  }

  return (
    <div className="space-y-10">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Organization staff is unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Everyone with an Organization staff role. Combined roles such as
            participant stay visible and keep their own access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberRows.map((entry) => (
                <TableRow key={entry.id}>
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
                  <TableCell colSpan={3}>No members yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite staff</CardTitle>
          <CardDescription>
            Owners can invite owners, admins, and members. Admins can invite
            admins and members. Coordination stays assignment-based and is never
            granted here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={sendInvite}>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="staff-invite-email">Email</Label>
              <Input
                id="staff-invite-email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="staff-invite-role">Role</Label>
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
              <Button disabled={invite.isPending || !email} type="submit">
                {invite.isPending ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            Cancel an invitation to revoke it before it is accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitationRows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.role ?? "member"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      disabled={cancel.isPending && cancel.variables === entry.id}
                      onClick={() => cancel.mutate(entry.id)}
                      type="button"
                      variant="outline"
                    >
                      {cancel.isPending && cancel.variables === entry.id
                        ? "Cancelling…"
                        : "Cancel"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invitationRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No pending invitations.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
