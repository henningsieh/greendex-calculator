import { handleOpenAPIRequest } from "@/lib/orpc/openapi-handler";

function handleRequest(request: Request) {
  return handleOpenAPIRequest(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
