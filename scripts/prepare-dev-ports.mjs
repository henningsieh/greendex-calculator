import { execFileSync } from "node:child_process";
import { realpathSync, readlinkSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
function portFromEnvironment(variableName) {
  const value = globalThis.process.env[variableName];

  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${variableName} must be an integer between 1 and 65535.`);
  }

  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error(`${variableName} must be an integer between 1 and 65535.`);
  }

  return port;
}

const portConfigurations = [
  {
    port: portFromEnvironment("PORT"),
    workspace: "apps/calculator",
    isExpectedCommand: (command) => /\bnext(?:\s+dev|-server\b)/.test(command),
  },
  {
    port: portFromEnvironment("DOCUMENTATION_PORT"),
    workspace: "apps/documentation",
    isExpectedCommand: (command) => /\bnext(?:\s+dev|-server\b)/.test(command),
  },
  {
    port: portFromEnvironment("SOCKET_PORT"),
    workspace: "apps/calculator",
    isExpectedCommand: (command) =>
      command.includes("tsx") && command.includes("socket-server"),
  },
];

function listenersForPort(port) {
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    return [...new Set(output.trim().split("\n").filter(Boolean).map(Number))];
  } catch (error) {
    if (error.status === 1) {
      return [];
    }

    throw new Error(`Unable to inspect port ${port} with lsof: ${error.message}`);
  }
}

function processDetails(pid) {
  try {
    const command = execFileSync("ps", ["-o", "args=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
    const cwd = realpathSync(readlinkSync(`/proc/${pid}/cwd`));

    return { command, cwd, pid };
  } catch (error) {
    if (error.code === "ENOENT" || error.status === 1) {
      return undefined;
    }

    throw new Error(`Unable to inspect process ${pid}: ${error.message}`);
  }
}

function belongsToWorkspace(process, configuration) {
  const workspaceDirectory = resolve(repositoryRoot, configuration.workspace);

  return (
    (process.cwd === workspaceDirectory ||
      relative(workspaceDirectory, process.cwd).startsWith("..") === false) &&
    configuration.isExpectedCommand(process.command)
  );
}

function describeProcess(process) {
  return `PID ${process.pid}: ${process.command} (cwd: ${process.cwd})`;
}

function waitForPortsToBecomeFree(ports, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const occupied = ports.filter((port) => listenersForPort(port).length > 0);
    if (occupied.length === 0) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }

  const occupied = ports.filter((port) => listenersForPort(port).length > 0);
  throw new Error(
    `Ports ${occupied.join(", ")} remained occupied after waiting 5 seconds.`,
  );
}

const listeners = portConfigurations.flatMap((configuration) =>
  listenersForPort(configuration.port).map((pid) => ({ configuration, pid })),
);
const processes = listeners
  .map(({ configuration, pid }) => ({
    configuration,
    process: processDetails(pid),
  }))
  .filter(({ process }) => process !== undefined);
const unexpected = processes.filter(
  ({ configuration, process }) => !belongsToWorkspace(process, configuration),
);

if (unexpected.length > 0) {
  const details = unexpected
    .map(({ process }) => describeProcess(process))
    .join("\n");
  throw new Error(
    `Refusing to stop listeners that are not this checkout's dev servers:\n${details}\n` +
      "Stop the listed process manually, then run pnpm dev again.",
  );
}

if (processes.length > 0) {
  for (const { configuration, process } of processes) {
    console.log(
      `Stopping this checkout's dev server on port ${configuration.port}: ${describeProcess(process)}`,
    );
    try {
      globalThis.process.kill(process.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  }

  waitForPortsToBecomeFree(portConfigurations.map(({ port }) => port));
}
