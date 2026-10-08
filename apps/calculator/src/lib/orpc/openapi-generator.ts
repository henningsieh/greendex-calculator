import {
  OpenAPIGenerator,
  type OpenAPIGeneratorGenerateOptions,
} from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { router } from "@/lib/orpc/router";

export function generateOpenAPISpec(
  base: OpenAPIGeneratorGenerateOptions<"3.1.1">["base"],
) {
  const generator = new OpenAPIGenerator({
    converters: [new ZodToJsonSchemaConverter()],
  });

  return generator.generate(router, { version: "3.1.1", base });
}
