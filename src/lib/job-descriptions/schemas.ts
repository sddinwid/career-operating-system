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
  publishedAt: z.preprocess(emptyToUndefined, dateStringSchema.optional())
});

export const saveApplicationJobDescriptionSchema = baseJobDescriptionSchema;

export const createStandaloneJobDescriptionSchema = baseJobDescriptionSchema.extend({
  companyName: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  jobUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Use a valid URL").optional()),
  opportunitySource: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional())
});

export type SaveApplicationJobDescriptionInput = z.infer<
  typeof saveApplicationJobDescriptionSchema
>;
export type CreateStandaloneJobDescriptionInput = z.infer<
  typeof createStandaloneJobDescriptionSchema
>;

export type JobDescriptionFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
