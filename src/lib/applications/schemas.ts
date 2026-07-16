import {
  ApplicationPriority,
  ApplicationStatus,
  WorkArrangement
} from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const currencySchema = z
  .preprocess(emptyToUndefined, z.string().trim().max(8).optional())
  .transform((value) => value?.toUpperCase());

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const optionalMoneySchema = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) {
    return undefined;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : normalized;
}, z.number().nonnegative("Must be zero or greater").optional());

const applicationFieldSchema = z.object({
  companyName: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().min(1, "Role is required"),
  appliedAtLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a valid local date and time"),
  manualJobSearchDate: z.preprocess(emptyToUndefined, dateStringSchema.optional()),
  jobUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Use a valid URL").optional()),
  source: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  salaryMin: optionalMoneySchema,
  salaryMax: optionalMoneySchema,
  salaryCurrency: currencySchema,
  location: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  workArrangement: z.preprocess(
    emptyToUndefined,
    z.nativeEnum(WorkArrangement).optional()
  ),
  priority: z.preprocess(
    emptyToUndefined,
    z.nativeEnum(ApplicationPriority).optional()
  ),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional())
});

function withSalaryValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, context) => {
    const salaryValue = value as {
      salaryMin?: number;
      salaryMax?: number;
    };

    if (
      salaryValue.salaryMin !== undefined &&
      salaryValue.salaryMax !== undefined &&
      salaryValue.salaryMax < salaryValue.salaryMin
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMax"],
        message: "Maximum salary must be greater than or equal to minimum salary"
      });
    }
  });
}

export const createApplicationSchema = withSalaryValidation(
  applicationFieldSchema
).transform((value) => ({
  ...value,
  status: ApplicationStatus.APPLIED
}));

export const updateApplicationSchema = withSalaryValidation(
  applicationFieldSchema.extend({
    status: z.nativeEnum(ApplicationStatus)
  })
);

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export type ApplicationFormState = {
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
