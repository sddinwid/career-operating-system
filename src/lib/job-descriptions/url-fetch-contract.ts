import { z } from "zod";

export const jobDescriptionFetchRequestSchema = z.object({
  url: z.string().trim().url("Use a valid URL")
});

export const jobDescriptionFetchDiagnosticSchema = z.object({
  code: z.string(),
  level: z.enum(["INFO", "WARNING", "ERROR"]).default("INFO"),
  message: z.string()
});

export const jobDescriptionFetchResponseSchema = z.object({
  requestedUrl: z.string().url(),
  finalUrl: z.string().url(),
  resolvedUrl: z.string().url().nullable().optional(),
  status: z.number().int().min(100).max(599),
  contentType: z.string(),
  retrievedAt: z.string(),
  pageTitle: z.string().nullable(),
  extractorVersion: z.string(),
  resolverVersion: z.string().nullable().optional(),
  extractionChecksum: z.string(),
  extractedText: z.string(),
  diagnostics: z.array(jobDescriptionFetchDiagnosticSchema)
});

export type JobDescriptionFetchRequest = z.infer<typeof jobDescriptionFetchRequestSchema>;
export type JobDescriptionFetchResponse = z.infer<typeof jobDescriptionFetchResponseSchema>;
export type JobDescriptionFetchDiagnostic = z.infer<typeof jobDescriptionFetchDiagnosticSchema>;
