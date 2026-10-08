import { createServer } from "node:http";

import { Server } from "socket.io";

// Environment variables are injected into the process by the environment:
// - locally, the dev/start scripts load the shared database `.env`, then Calculator's `.env`;
// - on Coolify, the platform injects them into the container.
// This module never touches .env files itself — it reads the validated process
// environment through the shared `@/env` module.
const { env } = await import("@/env");

const socketPort = env.SOCKET_PORT;
const corsOrigin = env.NEXT_PUBLIC_BASE_URL;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10_000,
  pingTimeout: 5000,
  connectTimeout: 45_000,
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit("message", {
    id: crypto.randomUUID(),
    text: "Welcome to Socket.IO!",
    timestamp: new Date().toISOString(),
  });

  socket.on("client-message", (data) => {
    console.log("Received from client:", data);
    socket.emit("message", {
      id: crypto.randomUUID(),
      text: `Server received: "${data.text}"`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

httpServer
  .listen(socketPort, () => {
    console.log(`Socket.IO server listening on port ${socketPort}`);
  })
  .on("error", (error: NodeJS.ErrnoException) => {
    console.error(
      `Failed to start Socket.IO server on port ${socketPort}:`,
      error,
    );
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${socketPort} is already in use. Please choose a different port.`,
      );
    }
    process.exit(1);
  });

// Graceful shutdown: close the socket server and HTTP server on signals
const shutdown = (signal?: string) => {
  console.log(`Received ${signal ?? "shutdown"}. Closing Socket.IO server...`);
  try {
    void io.close();
  } catch (e) {
    console.warn("Error while closing io:", e);
  }

  try {
    httpServer.close(() => {
      console.log("HTTP server closed. Exiting.");
      process.exit(0);
    });
  } catch (e) {
    console.warn("Error while closing httpServer:", e);
    process.exit(0);
  }

  // Fallback exit if close callbacks do not fire
  setTimeout(() => process.exit(0), 5000);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception, shutting down:", err);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection, shutting down:", reason);
  shutdown("unhandledRejection");
});
