import { z } from "zod";

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
