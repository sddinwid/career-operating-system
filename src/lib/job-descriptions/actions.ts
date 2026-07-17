"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  createStandaloneJobDescriptionSchema,
  saveApplicationJobDescriptionSchema,
  type JobDescriptionFormState
} from "@/lib/job-descriptions/schemas";
import {
  createJobDescriptionForNewOpportunity,
  JobDescriptionSubmissionError,
  saveJobDescriptionForApplication
} from "@/lib/job-descriptions/service";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function saveApplicationJobDescriptionAction(
  applicationId: string,
  _previousState: JobDescriptionFormState,
  formData: FormData
): Promise<JobDescriptionFormState> {
  const workspace = await getDefaultWorkspace();
  const parsed = saveApplicationJobDescriptionSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: "Please fix the highlighted fields and try again."
    };
  }

  try {
    const result = await saveJobDescriptionForApplication(
      workspace.id,
      applicationId,
      parsed.data
    );
    revalidatePath("/applications");
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath(`/job-descriptions/${result.version.id}`);
    redirect(
      `/applications/${applicationId}?success=${
        result.duplicate ? "job-description-duplicate" : "job-description-saved"
      }`
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      fieldErrors:
        error instanceof JobDescriptionSubmissionError ? error.fieldErrors : undefined,
      formError:
        error instanceof Error ? error.message : "The job description could not be saved."
    };
  }
}

export async function createStandaloneJobDescriptionAction(
  _previousState: JobDescriptionFormState,
  formData: FormData
): Promise<JobDescriptionFormState> {
  const workspace = await getDefaultWorkspace();
  const parsed = createStandaloneJobDescriptionSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: "Please fix the highlighted fields and try again."
    };
  }

  try {
    const result = await createJobDescriptionForNewOpportunity(
      workspace.id,
      parsed.data
    );
    revalidatePath("/applications");
    revalidatePath(`/job-descriptions/${result.version.id}`);
    redirect(
      `/job-descriptions/${result.version.id}?success=${
        result.duplicate ? "duplicate" : "created"
      }`
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      fieldErrors:
        error instanceof JobDescriptionSubmissionError ? error.fieldErrors : undefined,
      formError:
        error instanceof Error ? error.message : "The job description could not be saved."
    };
  }
}
