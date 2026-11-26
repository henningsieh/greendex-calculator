import { env } from "./env";
import { createRealtimeServer } from "./realtime-server";
import { createCostTrackerSessionValidator } from "./session-validator";

const server = createRealtimeServer({
  host: env.REALTIME_BIND_HOST,
  port: env.REALTIME_PORT,
  corsOrigin: env.COST_TRACKER_PUBLIC_URL,
  emitSecret: env.REALTIME_EMIT_SECRET,
  sessionValidator: createCostTrackerSessionValidator(
    env.COST_TRACKER_INTERNAL_URL,
  ),
});

try {
  const { port } = await server.start();
  console.info(
    `Realtime notifications listening on ${env.REALTIME_BIND_HOST}:${port}`,
  );
} catch (error) {
  console.error("Realtime notifications failed to start:", error);
  process.exit(1);
}

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; closing Realtime notifications.`);
  void server
    .stop()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
