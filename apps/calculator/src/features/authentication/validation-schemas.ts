import { z } from "zod";

import type messages from "@/messages/en.json";

type ValidationKey =
  `validation.${keyof typeof messages.authentication.validation}`;
type Translator = (key: ValidationKey) => string;

const email = (t: Translator) => z.email(t("validation.emailInvalid"));
const password = (t: Translator) =>
  z.string().min(6, t("validation.passwordMinLength"));
const confirmPassword = (t: Translator) =>
  z.string().min(1, t("validation.passwordConfirmRequired"));

export const createCredentialsSchema = (t: Translator) =>
  z.object({
    email: email(t),
    password: z.string().min(6, t("validation.passwordRequired")),
  });

export const createMagicLinkSchema = (t: Translator) =>
  z.object({ email: email(t) });
export const createForgotPasswordSchema = (t: Translator) =>
  z.object({ email: email(t) });

export const createSignupSchema = (t: Translator) =>
  z
    .object({
      name: z.string().min(1, t("validation.fullNameRequired")),
      email: email(t),
      password: password(t),
      confirmPassword: confirmPassword(t),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsNoMatch"),
      path: ["confirmPassword"],
    });

export const createResetPasswordSchema = (t: Translator) =>
  z
    .object({
      password: password(t),
      confirmPassword: confirmPassword(t),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsNoMatch"),
      path: ["confirmPassword"],
    });
