import { verifyEmailWorkflows } from "./verify-email-workflows";

// This focused entrypoint exercises both managed apps, not direct template sends.
verifyEmailWorkflows()
  .then((passed) => {
    if (!passed) process.exitCode = 1;
  })
  .catch(() => {
    console.error(
      "Real email workflow verification failed (private details suppressed).",
    );
    process.exitCode = 1;
  });
