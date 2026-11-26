import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  NOTIFICATION_CREATED_EVENT,
  RealtimeEmitRequestSchema,
  type NotificationCreated,
} from "@greendex/notifications";
import { Server as SocketServer } from "socket.io";

import type { SessionValidator } from "./session-validator";

const MAX_EMIT_BODY_BYTES = 1_048_576;

export type RealtimeServerOptions = {
  host: string;
  port: number;
  /** The only browser origin allowed to open a Socket.IO connection. */
  corsOrigin: string;
  emitSecret: string;
  sessionValidator: SessionValidator;
};

export type RealtimeServer = {
  start(): Promise<{ port: number }>;
  stop(): Promise<void>;
  address(): { port: number } | null;
};

type ClientToServerEvents = Record<string, never>;
type ServerToClientEvents = {
  [NOTIFICATION_CREATED_EVENT]: (notification: NotificationCreated) => void;
};
type InterServerEvents = Record<string, never>;
type SocketData = { userId: string };

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function personalRoom(userId: string): string {
  return `user:${userId}`;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_EMIT_BODY_BYTES)
      throw new HttpError(413, "Emit body exceeds the size limit.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Emit body must be JSON.");
  }
}

function hasValidEmitSecret(
  authorization: string | undefined,
  secret: string,
): boolean {
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return false;
  const provided = Buffer.from(authorization.slice(prefix.length), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return (
    provided.byteLength === expected.byteLength &&
    timingSafeEqual(provided, expected)
  );
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  options: RealtimeServerOptions,
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/emit") {
    sendJson(response, 404, { error: "not_found" });
    return;
  }
  if (!hasValidEmitSecret(request.headers.authorization, options.emitSecret)) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 400;
    sendJson(response, statusCode, { error: "invalid_request" });
    return;
  }
  const parsed = RealtimeEmitRequestSchema.safeParse(body);
  if (!parsed.success) {
    sendJson(response, 400, { error: "invalid_payload" });
    return;
  }

  for (const { recipientUserId, notification } of parsed.data.notifications)
    io.to(personalRoom(recipientUserId)).emit(
      NOTIFICATION_CREATED_EVENT,
      notification,
    );
  sendJson(response, 202, { accepted: parsed.data.notifications.length });
}

/**
 * Wires the HTTP surface and the Socket.IO server. The factory takes its
 * dependencies explicitly so tests can run an ephemeral instance without
 * environment variables or the Cost Tracker process.
 */
export function createRealtimeServer(
  options: RealtimeServerOptions,
): RealtimeServer {
  const httpServer = createServer();
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: options.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10_000,
    pingTimeout: 5000,
    connectTimeout: 45_000,
  });

  io.use(async (socket, next) => {
    try {
      const identity = await options.sessionValidator(
        socket.handshake.headers.cookie,
      );
      if (!identity) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.userId = identity.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Personal user room only: no organization rooms and no cross-user fan-out.
    void socket.join(personalRoom(socket.data.userId));
  });

  httpServer.on("request", (request, response) => {
    void handleRequest(request, response, io, options).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: "failed" });
      else response.destroy();
    });
  });

  return {
    async start() {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          httpServer.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          httpServer.off("error", onError);
          resolve();
        };
        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen({ port: options.port, host: options.host });
      });
      const address = httpServer.address();
      if (!address || typeof address === "string")
        throw new Error("Realtime server did not bind a TCP address.");
      return { port: address.port };
    },
    async stop() {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
    address() {
      const address = httpServer.address();
      return address && typeof address !== "string"
        ? { port: address.port }
        : null;
    },
  };
}
