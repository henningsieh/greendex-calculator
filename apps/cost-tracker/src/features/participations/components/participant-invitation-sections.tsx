"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Outputs } from "@/lib/orpc/router";

/** The list and mutations are scoped by the server's Partnership authorization, not client filtering. */
export function ParticipantInvitations({
  data,
  entryAccess,
  reissueInvitation,
  closeInvitation,
  entryDenial,
}: {
  data: Pick<Outputs["participations"]["listPartnership"], "invitations">;
  entryAccess: { permitted: boolean };
  reissueInvitation: { isPending: boolean; mutate: (email: string) => void };
  closeInvitation: { isPending: boolean; mutate: (id: string) => void };
  entryDenial: string | undefined;
}) {
  const t = useTranslations("participations");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("invitations.title")}</CardTitle>
        <CardDescription>{t("invitations.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.invitations.length === 0 ? (
          <p>{t("invitations.empty")}</p>
        ) : (
          <ul className="divide-y">
            {data.invitations.map((invitation) => (
              <li
                className="flex flex-wrap items-center gap-3 py-3"
                key={invitation.invitationId}
                data-testid={`participant-invitation-${invitation.invitationId}`}
                data-invitation-status={invitation.status}
              >
                <span>{invitation.email}</span>
                <Badge variant="secondary">
                  {invitation.status === "pending"
                    ? t("invitations.pending")
                    : t("invitations.status", { status: invitation.status })}
                </Badge>
                {entryAccess.permitted && invitation.status === "pending" && (
                  <Button
                    data-testid="reissue-participant-invitation"
                    type="button"
                    variant="outline"
                    disabled={
                      reissueInvitation.isPending || closeInvitation.isPending
                    }
                    onClick={() => reissueInvitation.mutate(invitation.email)}
                  >
                    {t("invitations.reissue")} {invitation.email}
                  </Button>
                )}
                {entryAccess.permitted && invitation.status === "pending" && (
                  <Button
                    data-testid={`close-participant-invitation-${invitation.invitationId}`}
                    type="button"
                    variant="outline"
                    disabled={
                      closeInvitation.isPending || reissueInvitation.isPending
                    }
                    onClick={() =>
                      closeInvitation.mutate(invitation.invitationId)
                    }
                  >
                    {t("invitations.close")} {invitation.email}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {t("invitations.statusHint")}
        </p>
        {entryDenial && (
          <p className="mt-2 text-sm text-muted-foreground">{entryDenial}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ParticipantRegistrationLinks({
  data,
  entryAccess,
  closeLink,
  reopenLink,
  entryDenial,
  setEntryFeedback,
}: {
  data: Pick<Outputs["participations"]["listPartnership"], "registrationLinks">;
  entryAccess: { permitted: boolean };
  closeLink: { isPending: boolean; mutate: (id: string) => void };
  reopenLink: { isPending: boolean; mutate: (id: string) => void };
  entryDenial: string | undefined;
  setEntryFeedback: (value: undefined) => void;
}) {
  const t = useTranslations("participations");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("links.title")}</CardTitle>
        <CardDescription>{t("links.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.registrationLinks.length === 0 ? (
          <p>{t("links.empty")}</p>
        ) : (
          <ul className="divide-y">
            {data.registrationLinks.map((link) => (
              <li
                data-link-open={String(link.enabled)}
                data-testid={`registration-link-${link.id}`}
                key={link.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span>
                  {t("links.link")} {link.id}
                </span>
                <Badge variant="secondary">
                  {link.enabled ? t("links.open") : t("links.closed")}
                </Badge>
                {entryAccess.permitted && link.enabled && (
                  <Button
                    data-testid="close-registration-link"
                    type="button"
                    variant="outline"
                    disabled={closeLink.isPending || reopenLink.isPending}
                    onClick={() => closeLink.mutate(link.id)}
                  >
                    {t("links.close")} {link.id}
                  </Button>
                )}
                {entryAccess.permitted && !link.enabled && (
                  <Button
                    data-testid="reopen-registration-link"
                    type="button"
                    variant="outline"
                    disabled={reopenLink.isPending || closeLink.isPending}
                    onClick={() => {
                      setEntryFeedback(undefined);
                      reopenLink.mutate(link.id);
                    }}
                  >
                    {t("links.reopen")} {link.id}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {entryDenial && (
          <p className="mt-4 text-sm text-muted-foreground">{entryDenial}</p>
        )}
      </CardContent>
    </Card>
  );
}
