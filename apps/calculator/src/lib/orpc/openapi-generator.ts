import {
  OpenAPIGenerator,
  type OpenAPIGeneratorGenerateOptions,
} from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

import { LifecycleRestBodySchema } from "@/features/projects/validation-schemas";
import { router } from "@/lib/orpc/router";

export async function generateOpenAPISpec(
  base: OpenAPIGeneratorGenerateOptions<"3.1.1">["base"],
) {
  const converter = new ZodToJsonSchemaConverter();
  const generator = new OpenAPIGenerator({ converters: [converter] });

  const spec = await generator.generate(router, { version: "3.1.1", base });
  for (const action of ["archive", "reopen"]) {
    const body = spec.paths?.[`/projects/{id}/${action}`]?.patch?.requestBody;
    if (body && "content" in body) {
      const [schema, optional] = converter.convert(
        LifecycleRestBodySchema,
        "input",
      );
      body.required = !optional;
      body.content["application/json"] = {
        schema,
      };
    }
  }
  return spec;
}
