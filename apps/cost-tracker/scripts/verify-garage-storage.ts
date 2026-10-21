import { env } from "@/env";

import { verifyDevelopmentGarage } from "./garage-verification";

const interruption = new AbortController();
const interrupt = () => interruption.abort();
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

try {
  await verifyDevelopmentGarage(env, interruption.signal);
} finally {
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}
