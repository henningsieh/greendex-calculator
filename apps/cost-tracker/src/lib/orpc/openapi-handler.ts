import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { ResponseHeadersHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { ERROR_STATUS_MAP } from "@/lib/orpc/error-status";
import { createSituationErrors } from "@/lib/orpc/errors";
import { router } from "@/lib/orpc/router";

const converters = [new ZodToJsonSchemaConverter()];
const generator = new OpenAPIGenerator({ converters });

export const openapiHandler = new OpenAPIHandler(router, {
  errorStatusMap: ERROR_STATUS_MAP,
  plugins: [
    new ResponseHeadersHandlerPlugin(),
    // REST JSON cannot carry native Dates; schema-driven coercion precedes the existing validation.
    new SmartCoercionHandlerPlugin({ converters }),
    new OpenAPIReferenceHandlerPlugin({
      docsPath: "/api/docs",
      specPath: "/api/openapi-spec",
      provider: "scalar",
      providerScriptUrl:
        "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.0/dist/browser/standalone.js",
      allow: async ({ context }) => {
        const session = await auth.api.getSession({ headers: context.headers });
        return Boolean(session?.session && session.user);
      },
      spec: () =>
        generator.generate(router, {
          errorStatusMap: ERROR_STATUS_MAP,
          base: {
            info: {
              title: "Cost Tracker API",
              version: "1.0.0",
              description:
                "Session-authenticated Cost Tracker procedures over HTTP. ISO 8601 date strings are coerced before schema validation.",
            },
            servers: [
              {
                url: `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/api/openapi`,
              },
            ],
          },
        }),
    }),
  ],
  routingInterceptors: [
    async ({ next, request }) => {
      const result = await next();
      if (result.matched)
        console.info(
          "[Cost Tracker OpenAPI]",
          request.method,
          request.url.split(/[?#]/)[0],
        );
      return result;
    },
  ],
  interceptors: [
    async ({ next }) => {
      try {
        return await next();
      } catch (error) {
        const errors = createSituationErrors();
        const normalized =
          error instanceof SyntaxError
            ? errors.badInput()
            : normalizeBetterAuthError(error, errors);
        console.error("[Cost Tracker OpenAPI]", { code: normalized.code });
        throw normalized;
      }
    },
  ],
});

export async function handleOpenAPIRequest(
  request: Request,
  prefix: "/api/openapi" | "" = "/api/openapi",
) {
  const { response } = await openapiHandler.handle(request, {
    prefix: prefix || undefined,
    context: { headers: request.headers },
  });
  return response ?? new Response("Not found", { status: 404 });
}
