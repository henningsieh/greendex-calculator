import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { EditNameSchema } from "@/features/user-settings/validation-schemas";
import { auth } from "@/lib/auth";
import { base } from "@/lib/orpc/context";
import { authorized } from "@/lib/orpc/middleware";

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

function throwSafeAuthError(response: Response, errors: ProcedureErrors): never {
  switch (response.status) {
    case 400:
      throw errors.BAD_REQUEST();
    case 401:
      throw errors.UNAUTHORIZED();
    case 403:
      throw errors.FORBIDDEN();
    case 429:
      throw errors.TOO_MANY_REQUESTS();
    default:
      throw errors.INTERNAL_SERVER_ERROR();
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
    if (!response.ok) throwSafeAuthError(response, errors);
    return response;
  } catch (error) {
    if (error instanceof ORPCError) throw error;
    console.error("Cost Tracker authentication command failed", error);
    throw errors.INTERNAL_SERVER_ERROR();
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
  .output(SocialSignInSchema)
  .handler(async ({ context, errors }) => {
    const response = await callBetterAuth(context, errors, () =>
      auth.api.signInSocial({
        asResponse: true,
        body: { callbackURL: "/projects", provider: "google" },
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
  .output(SuccessSchema)
  .handler(async ({ context, errors, input }) => {
    await callBetterAuth(context, errors, () =>
      auth.api.createOrganization({
        asResponse: true,
        body: input,
        headers: context.headers,
      }),
    );

    return { success: true };
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
