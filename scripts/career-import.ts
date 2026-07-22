import process from "node:process";
import { CareerProfilePurpose } from "@prisma/client";
import {
  formatCareerImportReport,
  importCareerKnowledge
} from "../src/lib/career/service";

function parseArgs(argv: string[]) {
  const fileFlagIndex = argv.findIndex((arg) => arg === "--file");
  const filePath =
    fileFlagIndex >= 0 && fileFlagIndex + 1 < argv.length
      ? argv[fileFlagIndex + 1]
      : undefined;

  return {
    filePath,
    dryRun: argv.includes("--dry-run"),
    purpose: argv.includes("--fixture")
      ? CareerProfilePurpose.FIXTURE
      : CareerProfilePurpose.USER,
    setAsCurrent: argv.includes("--no-current") ? false : undefined
  };
}

async function main() {
  const { filePath, dryRun, purpose, setAsCurrent } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error("Missing required --file <path> argument.");
    process.exitCode = 1;
    return;
  }

  const report = await importCareerKnowledge({
    filePath,
    dryRun,
    purpose,
    setAsCurrent
  });

  console.log(formatCareerImportReport(report));

  if (report.validation.errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Career knowledge import failed."
  );
  process.exitCode = 1;
});
