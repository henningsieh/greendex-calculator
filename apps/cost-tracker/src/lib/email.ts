import { createEmailSender, createTransporter } from "@greendex/email";

import { env } from "@/env";

export const emailSender = createEmailSender({
  baseUrl: env.NEXT_PUBLIC_BASE_URL,
  sender: env.SMTP_SENDER,
  transporter: createTransporter({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD },
  }),
});
