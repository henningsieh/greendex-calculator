import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { NextResponse } from "next/server";

import { router } from "@/lib/orpc/router";

/**
 * OpenAPI specification endpoint
 * Generates the OpenAPI 3.1 specification from the oRPC router
 * Used by Scalar UI and other API documentation tools
 */
export async function GET() {
  const generator = new OpenAPIGenerator({
    converters: [new ZodToJsonSchemaConverter()],
  });

  const spec = await generator.generate(router, {
    version: "3.1.1",
    base: {
      info: {
        title: "Greendex Calculator API",
        version: "1.0.0",
        description:
          "API for the Greendex Calculator application. This API provides endpoints for project management, organization management, and user authentication.",
      },
      servers: [
        {
          url: "/api/openapi",
          description: "OpenAPI REST endpoint",
        },
      ],
    },
  });

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
