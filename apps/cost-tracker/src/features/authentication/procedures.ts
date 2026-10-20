import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { z } from "zod";

import { EditNameSchema } from "@/features/user-settings/validation-schemas";
import { auth } from "@/lib/auth";
import {
  normalizeBetterAuthError,
  normalizeBetterAuthResponse,
} from "@/lib/orpc/better-auth-errors";
import { base } from "@/lib/orpc/context";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";
import { safeSignInReturnTo } from "@/lib/session";

const SignInInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const SignUpInputSchema = SignInInputSchema.extend({
  name: EditNameSchema.shape.name,
});

const CreateOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120),
  country: z.enum(EU_COUNTRY_CODES),
});

const GoogleSignInInputSchema = z.object({
  returnTo: z.string().optional(),
});
const SuccessSchema = z.object({ success: z.literal(true) });
const SocialSignInSchema = z.object({ url: z.url() });
const BetterAuthSocialResponseSchema = z.object({
  redirect: z.literal(true),
  url: z.url(),
});

type ProcedureContext = {
  headers: Headers;
  resHeaders?: Headers;
};

type ProcedureErrors = Parameters<
  Parameters<typeof base.handler>[0]
>[0]["errors"];

function forwardCookies(response: Response, context: ProcedureContext) {
  if (!context.resHeaders) return;

  for (const cookie of response.headers.getSetCookie()) {
    context.resHeaders.append("set-cookie", cookie);
  }
}

async function callBetterAuth(
  context: ProcedureContext,
  errors: ProcedureErrors,
  request: () => Promise<Response>,
) {
  try {
    const response = await request();
    forwardCookies(response, context);
    if (!response.ok)
      throw await normalizeBetterAuthResponse(
        response,
        createSituationErrors(errors),
      );
    return response;
  } catch (error) {
    throw normalizeBetterAuthError(
      error,
      createSituationErrors(errors),
      context.resHeaders,
    );
  }
}

export const signIn = base
  .input(SignInInputSchema)
  .output(SuccessSchema)
  .handler(async ({ context, errors, input }) => {
    await callBetterAuth(context, errors, () =>
      auth.api.signInEmail({
        asResponse: true,
        body: input,
        headers: context.headers,
      }),
    );

    return { success: true };
  });

export const signUp = base
  .input(SignUpInputSchema)
  .output(SuccessSchema)
  .handler(async ({ context, errors, input }) => {
    await callBetterAuth(context, errors, () =>
      auth.api.signUpEmail({
        asResponse: true,
        body: input,
        headers: context.headers,
      }),
    );

    return { success: true };
  });

export const startGoogleSignIn = base
  .input(GoogleSignInInputSchema.optional())
  .output(SocialSignInSchema)
  .handler(async ({ context, errors, input }) => {
    // Only the validated invitation route survives OAuth; anything else
    // falls back to the Project list so callbackURL can never be abused.
    const callbackURL = safeSignInReturnTo(input?.returnTo) ?? "/projects";
    const response = await callBetterAuth(context, errors, () =>
      auth.api.signInSocial({
        asResponse: true,
        body: { callbackURL, provider: "google" },
        headers: context.headers,
      }),
    );

    return BetterAuthSocialResponseSchema.parse(await response.json());
  });

export const signOut = base
  .output(SuccessSchema)
  .handler(async ({ context, errors }) => {
    await callBetterAuth(context, errors, () =>
      auth.api.signOut({ asResponse: true, headers: context.headers }),
    );

    return { success: true };
  });

export const createOrganization = authorized
  .input(CreateOrganizationInputSchema)
  .output(
    z.object({ success: z.literal(true), organizationId: z.string().min(1) }),
  )
  .handler(async ({ context, errors, input }) => {
    const response = await callBetterAuth(context, errors, async () => {
      const response = await auth.api.createOrganization({
        asResponse: true,
        body: {
          ...input,
          keepCurrentActiveOrganization: Boolean(
            context.session.activeOrganizationId,
          ),
        },
        headers: context.headers,
      });
      if (response.status === 400) {
        const body: unknown = await response
          .clone()
          .json()
          .catch(() => undefined);
        const refusal = z
          .object({ code: z.literal("ORGANIZATION_ALREADY_EXISTS") })
          .safeParse(body);
        if (refusal.success) {
          forwardCookies(response, context);
          throw createSituationErrors(
            errors,
          ).organizationSlugTakenBeforeCreation();
        }
      }
      return response;
    });
    const organization = z
      .object({ id: z.string().min(1) })
      .parse(await response.json());
    return { success: true, organizationId: organization.id };
  });

export const updateUser = authorized
  .input(EditNameSchema)
  .output(SuccessSchema)
  .handler(async ({ context, errors, input }) => {
    await callBetterAuth(context, errors, () =>
      auth.api.updateUser({
        asResponse: true,
        body: input,
        headers: context.headers,
      }),
    );

    return { success: true };
  });
