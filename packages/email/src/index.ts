/**
 * @greendex/email
 * Email sending utilities and templates
 */

// Export email sending utilities
export { createTransporter, type SmtpConfig } from "./config";
export {
  createEmailSender,
  type CreateEmailSenderOptions,
  type EmailSender,
  type SendEmailVerificationEmailParams,
  type SendMagicLinkEmailParams,
  type SendOrganizationInvitationParams,
  type SendParticipantInvitationParams,
  type SendPasswordResetEmailParams,
} from "./email-sender";

// Export utility functions
export { maskEmail } from "./utils";

// Export templates from their own module
export * from "./templates";
