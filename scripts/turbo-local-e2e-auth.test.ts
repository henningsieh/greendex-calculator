import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("Turbo local E2E auth forwarding", () => {
  it("forwards the test-server marker and explicit opt-out to both dev tasks", () => {
    const output = execFileSync(
      "pnpm",
      [
        "exec",
        "turbo",
        "run",
        "dev",
        "--filter=@greendex/calculator",
        "--filter=@greendex/cost-tracker",
        "--env-mode=strict",
        "--dry=json",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GREENDEX_LOCAL_TEST_SERVER: "1",
          LOCAL_E2E_AUTH: "0",
        },
        encoding: "utf8",
      },
    );
    const result: {
      tasks: { taskId: string; environmentVariables: { configured: string[] } }[];
    } = JSON.parse(output);

    for (const app of ["calculator", "cost-tracker"]) {
      const task = result.tasks.find(
        (item) => item.taskId === `@greendex/${app}#dev`,
      );
      expect(task?.environmentVariables.configured).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^GREENDEX_LOCAL_TEST_SERVER=/),
          expect.stringMatching(/^LOCAL_E2E_AUTH=/),
        ]),
      );
    }
  });
});
