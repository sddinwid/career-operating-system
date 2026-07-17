import { z } from "zod";

export const editableApplicationGridFields = [
  "status",
  "priority",
  "source",
  "location",
  "workArrangement",
  "salary",
  "appliedAt",
  "jobSearchDate",
  "company",
  "role"
] as const;

export type EditableApplicationGridField =
  (typeof editableApplicationGridFields)[number];

export const updateApplicationGridFieldSchema = z.object({
  applicationId: z.string().trim().min(1, "Application id is required."),
  field: z.enum(editableApplicationGridFields),
  value: z.string().nullable()
});

export type UpdateApplicationGridFieldPayload = z.infer<
  typeof updateApplicationGridFieldSchema
>;
