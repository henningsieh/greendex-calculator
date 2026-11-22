import { spawn } from "node:child_process";

type Check = {
  name: string;
  command: string;
  args: string[];
};

const workspaceLint: Check = {
  name: "workspace-lint",
  command: "pnpm",
  args: ["exec", "turbo", "run", "lint", "--concurrency=3"],
};

// These checks can read the final sources concurrently after workspace autofixes.
const checks: Check[] = [
  {
    name: "cost-tracker-workflows",
    command: "pnpm",
    args: ["run", "check:cost-tracker-workflows"],
  },
  { name: "tailwind", command: "pnpm", args: ["run", "check:tailwind"] },
  {
    name: "schema-derivation",
    command: "pnpm",
    args: ["run", "check:schema-derivation"],
  },
  {
    name: "schema-duplication",
    command: "pnpm",
    args: ["run", "check:schema-duplication"],
  },
  { name: "schema-types", command: "pnpm", args: ["run", "check:schema-types"] },
  {
    name: "agent-instructions",
    command: "pnpm",
    args: ["run", "check:agent-instructions"],
  },
  {
    name: "persistence-seam",
    command: "pnpm",
    args: ["run", "check:cost-tracker-persistence-seam"],
  },
  {
    name: "copy-assertions",
    command: "pnpm",
    args: ["run", "check:no-copy-assertions"],
  },
];

function prefixStream(
  stream: NodeJS.ReadableStream,
  target: NodeJS.WriteStream,
  name: string,
): void {
  let buffered = "";
  stream.on("data", (chunk: Buffer) => {
    buffered += chunk.toString();
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => {
    if (buffered) target.write(`[${name}] ${buffered}\n`);
  });
}

function run(check: Check): Promise<{ name: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(check.command, check.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    prefixStream(child.stdout, process.stdout, check.name);
    prefixStream(child.stderr, process.stderr, check.name);
    child.on("error", (error) => {
      process.stderr.write(`[${check.name}] ${error.message}\n`);
      resolve({ name: check.name, code: 1 });
    });
    child.on("close", (code) => {
      resolve({ name: check.name, code: code ?? 1 });
    });
  });
}

async function main(): Promise<void> {
  const workspaceResult = await run(workspaceLint);
  const results = [workspaceResult, ...(await Promise.all(checks.map(run)))];
  const failures = results.filter((result) => result.code !== 0);
  if (failures.length) {
    process.stderr.write(
      `\nLint failed in ${failures.length} check(s):\n${failures
        .map((failure) => `- ${failure.name} (exit ${failure.code})`)
        .join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("\nAll lint checks passed.\n");
}

void main();
