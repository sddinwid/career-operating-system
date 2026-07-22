import { JobDescriptionSourceType } from "@prisma/client";
import { z } from "zod";
import { MAX_JOB_DESCRIPTION_CHARACTERS } from "@/lib/job-descriptions/normalize";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const baseJobDescriptionSchema = z.object({
  descriptionText: z
    .string()
    .max(
      MAX_JOB_DESCRIPTION_CHARACTERS,
      `Use ${MAX_JOB_DESCRIPTION_CHARACTERS.toLocaleString()} characters or fewer`
    )
    .refine((value) => value.trim().length > 0, {
      message: "Job description text is required"
    }),
  sourceUrl: z.preprocess(
    emptyToUndefined,
    z.string().trim().url("Use a valid URL").optional()
  ),
  sourceType: z.nativeEnum(JobDescriptionSourceType),
  sourceTitle: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  sourceFilename: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(255).optional()
  ),
  publishedAt: z.preprocess(emptyToUndefined, dateStringSchema.optional()),
  intakeMode: z.enum(["paste", "url"]).default("paste"),
  fetchedRequestedUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
  fetchedFinalUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
  fetchedResolvedUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
  fetchedStatus: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(100).max(599).optional()
  ),
  fetchedContentType: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  fetchedRetrievedAt: z.preprocess(emptyToUndefined, z.string().trim().max(64).optional()),
  fetchedPageTitle: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  fetchedExtractorVersion: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  fetchedResolverVersion: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  fetchedExtractionChecksum: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(128).optional()
  ),
  fetchedDiagnostics: z.preprocess(emptyToUndefined, z.string().trim().optional())
});

export const saveApplicationJobDescriptionSchema = baseJobDescriptionSchema;

export const createStandaloneJobDescriptionSchema = baseJobDescriptionSchema.extend({
  companyName: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  jobUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Use a valid URL").optional()),
  opportunitySource: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional())
});

type ParsedSaveApplicationJobDescriptionInput = z.infer<
  typeof saveApplicationJobDescriptionSchema
>;
type ParsedCreateStandaloneJobDescriptionInput = z.infer<
  typeof createStandaloneJobDescriptionSchema
>;

export type SaveApplicationJobDescriptionInput = Omit<
  ParsedSaveApplicationJobDescriptionInput,
  "intakeMode"
> & {
  intakeMode?: "paste" | "url";
};
export type CreateStandaloneJobDescriptionInput = Omit<
  ParsedCreateStandaloneJobDescriptionInput,
  "intakeMode"
> & {
  intakeMode?: "paste" | "url";
};

export type JobDescriptionFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
