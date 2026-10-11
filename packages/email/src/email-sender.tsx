import type { Transporter } from "nodemailer";
import React from "react";
import { render } from "react-email";

import { sendEmail } from "./send";
import {
  EmailVerification,
  OrganizationInvitation,
  ParticipantInvitation,
  PasswordResetEmail,
} from "./templates";

interface User {
  email: string;
  name?: string;
}

export interface SendPasswordResetEmailParams {
  user: User;
  url: string;
}

export interface SendEmailVerificationEmailParams {
  user: User;
  url: string;
}

export interface SendOrganizationInvitationParams {
  email: string;
  inviteLink: string;
  organizationName: string;
  inviterName?: string;
}

export interface SendParticipantInvitationParams {
  email: string;
  inviteLink: string;
}

export interface SendMagicLinkEmailParams {
  email: string;
  url: string;
}

export interface EmailSender {
  sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void>;
  sendEmailVerificationEmail(
    params: SendEmailVerificationEmailParams,
  ): Promise<void>;
  sendOrganizationInvitation(
    params: SendOrganizationInvitationParams,
  ): Promise<void>;
  sendParticipantInvitation(
    params: SendParticipantInvitationParams,
  ): Promise<void>;
  sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<void>;
}

export interface CreateEmailSenderOptions {
  baseUrl: string;
  transporter: Transporter;
  sender: string;
}

/**
 * Creates an email sender that renders and delivers Greendex transactional emails.
 * SMTP configuration stays with the consuming application; the templates and their
 * delivery behaviour remain in this package.
 */
export function createEmailSender({
  baseUrl,
  transporter,
  sender,
}: CreateEmailSenderOptions): EmailSender {
  return {
    async sendPasswordResetEmail({ user, url }) {
      const html = await render(
        <PasswordResetEmail
          baseUrl={baseUrl}
          userName={user.name}
          resetUrl={url}
        />,
      );

      await sendEmail(
        {
          to: user.email,
          subject: "Reset Your Password",
          html,
        },
        transporter,
        sender,
      );
    },

    async sendEmailVerificationEmail({ user, url }) {
      const html = await render(
        <EmailVerification
          baseUrl={baseUrl}
          userName={user.name}
          verificationUrl={url}
        />,
      );

      await sendEmail(
        {
          to: user.email,
          subject: "Verify Your Email Address",
          html,
        },
        transporter,
        sender,
      );
    },

    async sendOrganizationInvitation({
      email,
      inviteLink,
      organizationName,
      inviterName,
    }) {
      const html = await render(
        <OrganizationInvitation
          baseUrl={baseUrl}
          organizationName={organizationName}
          inviterName={inviterName}
          inviteLink={inviteLink}
        />,
      );

      await sendEmail(
        {
          to: email,
          subject: `You're invited to join ${organizationName}`,
          html,
        },
        transporter,
        sender,
      );
    },

    async sendParticipantInvitation({ email, inviteLink }) {
      const html = await render(
        <ParticipantInvitation baseUrl={baseUrl} inviteLink={inviteLink} />,
      );

      await sendEmail(
        { to: email, subject: "Your Participant Invitation", html },
        transporter,
        sender,
      );
    },

    async sendMagicLinkEmail({ email, url }) {
      await sendEmail(
        {
          to: email,
          subject: "Sign in to your account",
          html: `<p>Click the link below to sign in:</p><a href="${url}">Sign in</a>`,
          text: `Click the link below to sign in: ${url}`,
        },
        transporter,
        sender,
      );
    },
  };
}
