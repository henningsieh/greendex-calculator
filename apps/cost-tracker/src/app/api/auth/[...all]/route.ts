import { toNextJsHandler } from "better-auth/next-js";

import { env } from "@/env";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

// #273: exact managed-run identity prevents readiness on an unrelated dev server.
function withRunIdentity(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (env.TEST_RUN_ID)
      response.headers.set("X-Greendex-Test-Run", env.TEST_RUN_ID);
    return response;
  };
}

export const GET = withRunIdentity(handlers.GET);
export const POST = withRunIdentity(handlers.POST);
