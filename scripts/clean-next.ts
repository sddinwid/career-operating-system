import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

async function main() {
  const nextDir = path.resolve(process.cwd(), ".next");

  if (!existsSync(nextDir)) {
    return;
  }

  await fs.rm(nextDir, {
    recursive: true,
    force: true
  });
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Failed to clean .next artifacts."
  );
  process.exitCode = 1;
});
