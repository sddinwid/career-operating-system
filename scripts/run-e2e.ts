import { spawn } from "node:child_process";
import process from "node:process";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const NEXT_BIN = "node_modules/next/dist/bin/next";
const PLAYWRIGHT_CLI = "node_modules/playwright/cli.js";
const TSX_CLI = "node_modules/tsx/dist/cli.mjs";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is ready or we hit the timeout.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url} to become ready.`);
}

function runCommand(
  command: string,
  args: string[],
  env?: Record<string, string | undefined>
) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        ...env
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function stopServerTree(pid: number) {
  if (process.platform === "win32") {
    await new Promise<void>((resolve, reject) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore"
      });

      killer.on("error", reject);
      killer.on("exit", (code) => {
        if (code === 0 || code === 1 || code === 128 || code === 255) {
          resolve();
          return;
        }

        reject(new Error(`taskkill failed with exit code ${code ?? 1}`));
      });
    });

    return;
  }

  process.kill(pid, "SIGTERM");
}

async function main() {
  const prepareExitCode = await runCommand(process.execPath, [TSX_CLI, "scripts/prepare-e2e.ts"]);
  if (prepareExitCode !== 0) {
    process.exit(prepareExitCode);
  }

  const server = spawn(process.execPath, [NEXT_BIN, "dev", "--port", String(PORT)], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT)
    }
  });

  let shutdownRequested = false;

  const shutdownServer = async () => {
    if (shutdownRequested || server.pid === undefined) {
      return;
    }

    shutdownRequested = true;
    await stopServerTree(server.pid);
  };

  try {
    server.on("error", (error) => {
      throw error;
    });

    await waitForServer(BASE_URL, 60_000);

    const playwrightExitCode = await runCommand(process.execPath, [PLAYWRIGHT_CLI, "test"], {
      PLAYWRIGHT_MANAGED_SERVER: "1"
    });

    await shutdownServer();
    process.exit(playwrightExitCode);
  } catch (error) {
    await shutdownServer();
    throw error;
  }
}

main().catch((error) => {
  console.error("run-e2e failed", error);
  process.exit(1);
});
