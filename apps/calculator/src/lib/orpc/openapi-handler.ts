import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { CORSHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { router } from "@/lib/orpc/router";

/**
 * Centralized OpenAPI handler used by both `/api/openapi` and `/api/docs`.
 *
 * - Serves the OpenAPI REST endpoints under `/api/openapi/*`
 * - Serves the interactive API reference UI at `/api/docs` (Scalar)
 */
const generator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
});

export const openapiHandler = new OpenAPIHandler(router, {
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
        generator.generate(router, {
          version: "3.1.1",
          base: {
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
          },
        }),
    }),
  ],
  interceptors: [
    onError((error) => {
      const isParsingError = error instanceof SyntaxError;
      const isClientError =
        error && typeof error === "object" && "status" in error
          ? (error.status as number) >= 400 && (error.status as number) < 500
          : false;

      if (isParsingError || isClientError) {
        return;
      }

      console.error("[OpenAPI Error]", error);
    }),
  ],
});
