import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

function loadLocalEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = normalizedValue;
  }
}

if (!process.env.DATABASE_URL) {
  loadLocalEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadLocalEnvFile(path.resolve(process.cwd(), ".env"));
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  LOCAL_DATA_DIR: z.string().min(1),
  DEFAULT_TIME_ZONE: z.string().min(1),
  JOB_SEARCH_DAY_CUTOFF: z.string().regex(/^\d{2}:\d{2}$/),
  OPENAI_API_KEY: z.string().optional().default("")
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  LOCAL_DATA_DIR: process.env.LOCAL_DATA_DIR,
  DEFAULT_TIME_ZONE: process.env.DEFAULT_TIME_ZONE,
  JOB_SEARCH_DAY_CUTOFF: process.env.JOB_SEARCH_DAY_CUTOFF,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
});
