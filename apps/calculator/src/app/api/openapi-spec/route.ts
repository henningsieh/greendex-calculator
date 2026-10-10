import { NextResponse } from "next/server";

import { generateOpenAPISpec } from "@/lib/orpc/openapi-generator";

/**
 * OpenAPI specification endpoint
 * Generates the OpenAPI 3.1 specification from the oRPC router
 * Used by Scalar UI and other API documentation tools
 */
export async function GET() {
  const spec = await generateOpenAPISpec({
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
  });

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
