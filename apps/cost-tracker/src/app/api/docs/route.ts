import { handleOpenAPIRequest } from "@/lib/orpc/openapi-handler";

export function GET(request: Request) {
  return handleOpenAPIRequest(request, "");
}
