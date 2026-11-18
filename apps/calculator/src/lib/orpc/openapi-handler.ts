import { getOpenAPIMeta, OpenAPISerializer } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { CORSHandlerPlugin } from "@orpc/server/plugins";

import { LifecycleRestBodySchema } from "@/features/projects/validation-schemas";
import { ERROR_STATUS_MAP, getErrorStatus } from "@/lib/orpc/error-status";
import { generateOpenAPISpec } from "@/lib/orpc/openapi-generator";
import { router } from "@/lib/orpc/router";

const serializer = new OpenAPISerializer();

/**
 * Centralized OpenAPI handler used by both `/api/openapi` and `/api/docs`.
 *
 * - Serves the OpenAPI REST endpoints under `/api/openapi/*`
 * - Serves the interactive API reference UI at `/api/docs` (Scalar)
 */
export const openapiHandler = new OpenAPIHandler(router, {
  errorStatusMap: ERROR_STATUS_MAP,
  plugins: [
    new CORSHandlerPlugin({
      origin: (origin) => origin,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Disposition"],
      credentials: true,
    }),
    new OpenAPIReferenceHandlerPlugin({
      provider: "scalar",
      providerScriptUrl:
        "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.73.0",
      docsPath: "/api/docs",
      specPath: "/api/openapi-spec",
      spec: () =>
        generateOpenAPISpec({
          info: {
            title: "Greendex Calculator API",
            version: "1.0.0",
          },
          // The OpenAPI `servers` property sets the base URL used by the
          // generated spec and documentation UI. We serve REST endpoints under
          // `/api/openapi/*`, so expose that as the server URL. This makes
          // tools like Scalar and generated curl examples include the correct
          // `/api/openapi` prefix (e.g. `/api/openapi/health`).
          servers: [{ url: "/api/openapi" }],
        }),
    }),
  ],
  interceptors: [
    async ({ procedure, request, next }) => {
      const route = getOpenAPIMeta(procedure);
      if (
        route?.method === "PATCH" &&
        (route.path === "/projects/{id}/archive" ||
          route.path === "/projects/{id}/reopen")
      ) {
        let body: unknown;
        try {
          body = await request.resolveBody();
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", { cause: error });
        }
        if (
          !LifecycleRestBodySchema.safeParse(serializer.deserialize(body)).success
        ) {
          throw new ORPCError("BAD_REQUEST");
        }
        request.resolveBody = async () => body;
      }
      return next();
    },
    onError((error) => {
      const isParsingError = error instanceof SyntaxError;
      const isClientError =
        error instanceof ORPCError
          ? getErrorStatus(error.code) >= 400 && getErrorStatus(error.code) < 500
          : false;

      if (isParsingError || isClientError) {
        return;
      }

      console.error("[OpenAPI Error]", error);
    }),
  ],
});
