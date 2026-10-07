import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  CORSPlugin,
  GetMethodCsrfProtectionHandlerPlugin,
} from "@orpc/server/plugins";
import { RPC_DEFAULT_ALLOW_METHODS } from "@orpc/server/standard";

import { router } from "@/lib/orpc/router";

/**
 * oRPC RPC handler for Next.js route handlers
 * Handles efficient RPC protocol requests (used by the Next.js app)
 * This matches with RPCLink on the client side for optimal performance
 */
const handler = new RPCHandler(router, {
  allowMethods: ["GET", ...RPC_DEFAULT_ALLOW_METHODS],
  plugins: [new CORSPlugin(), new GetMethodCsrfProtectionHandlerPlugin()],
  interceptors: [
    onError((error) => {
      console.error("[oRPC Error]", error);
    }),
  ],
});

/**
 * Universal request handler for all HTTP methods
 * Handles RPC requests from the client-side RPCLink
 */
async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: {
      headers: request.headers,
    },
  });

  return response ?? new Response("Not found", { status: 404 });
}

// Export all HTTP method handlers required by Next.js
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
