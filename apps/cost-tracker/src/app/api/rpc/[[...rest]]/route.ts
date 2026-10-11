import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  ResponseHeadersHandlerPlugin,
  GetMethodCsrfProtectionHandlerPlugin,
} from "@orpc/server/plugins";
import { RPC_DEFAULT_ALLOW_METHODS } from "@orpc/server/standard";

import { normalizeBetterAuthError } from "@/lib/orpc/better-auth-errors";
import { ERROR_STATUS_MAP } from "@/lib/orpc/error-status";
import { createSituationErrors } from "@/lib/orpc/errors";
import { router } from "@/lib/orpc/router";

const handler = new RPCHandler(router, {
  errorStatusMap: ERROR_STATUS_MAP,
  allowMethods: ["GET", ...RPC_DEFAULT_ALLOW_METHODS],
  plugins: [
    new ResponseHeadersHandlerPlugin(),
    new GetMethodCsrfProtectionHandlerPlugin(),
  ],
  interceptors: [
    async (options) => {
      try {
        return await options.next();
      } catch (error) {
        throw normalizeBetterAuthError(error, createSituationErrors());
      }
    },
    onError((error) => {
      console.error("[Cost Tracker oRPC]", {
        code: normalizeBetterAuthError(error, createSituationErrors()).code,
      });
    }),
  ],
});

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: { headers: request.headers },
  });

  return response ?? new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
