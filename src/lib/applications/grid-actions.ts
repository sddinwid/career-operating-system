"use server";

import { revalidatePath } from "next/cache";
import { getDefaultWorkspace } from "@/lib/workspace";
import { updateApplicationGridFieldSchema } from "@/lib/applications/grid-schemas";
import {
  ApplicationSubmissionError,
  updateApplicationGridField
} from "@/lib/applications/service";
import type { ApplicationGridMutationResult } from "@/lib/applications/grid";

export async function updateApplicationGridFieldAction(
  payload: unknown
): Promise<ApplicationGridMutationResult> {
  const workspace = await getDefaultWorkspace();
  const parsed = updateApplicationGridFieldSchema.safeParse(payload);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: "Please fix the edited value and try again.",
      fieldErrors
    };
  }

  try {
    const row = await updateApplicationGridField(workspace.id, parsed.data);
    revalidatePath("/applications");
    revalidatePath(`/applications/${parsed.data.applicationId}`);

    return {
      ok: true,
      row,
      message: "Application updated."
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The application could not be updated.",
      fieldErrors:
        error instanceof ApplicationSubmissionError ? error.fieldErrors : undefined
    };
  }
}
