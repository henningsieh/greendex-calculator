import { verifyEmailWorkflows } from "./verify-email-workflows";

const interruption = new AbortController();
const interrupt = () => interruption.abort();
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

verifyEmailWorkflows(undefined, interruption.signal)
  .then((passed) => {
    if (!passed) process.exitCode = 1;
  })
  .catch(() => {
    console.error(
      "Real email workflow verification failed (private details suppressed).",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  });
