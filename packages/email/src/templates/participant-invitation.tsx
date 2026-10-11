import React from "react";
import { Section } from "react-email";

import { EmailButton } from "../components/email-button";
import { EmailCode } from "../components/email-code";
import { EmailHeading } from "../components/email-heading";
import { EmailText } from "../components/email-text";
import { emailSpacing } from "../config/styles";
import { EmailLayout } from "./components/email-layout";

interface ParticipantInvitationProps {
  baseUrl: string;
  inviteLink: string;
}

export function ParticipantInvitation({
  baseUrl,
  inviteLink,
}: ParticipantInvitationProps) {
  return (
    <EmailLayout previewText="Your Participant Invitation" websiteUrl={baseUrl}>
      <EmailHeading>Participant Invitation</EmailHeading>
      <EmailText>
        You have been invited to take part in a Project on Greendex. Sign in or
        create an account, then complete your Participant profile and agreement to
        join.
      </EmailText>
      <Section style={emailSpacing.section}>
        <EmailButton href={inviteLink}>Accept Participant Invitation</EmailButton>
      </Section>
      <EmailText variant="muted">
        If the button doesn't work, copy and paste this link into your browser:
      </EmailText>
      <EmailCode>{inviteLink}</EmailCode>
      <EmailText variant="muted">
        If you didn't expect this invitation, you can safely ignore this email.
      </EmailText>
    </EmailLayout>
  );
}
