"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  ApplicationFormState,
  createApplicationSchema,
  updateApplicationSchema
} from "@/lib/applications/schemas";
import {
  ApplicationSubmissionError,
  archiveApplication,
  createApplication,
  restoreApplication,
  updateApplication
} from "@/lib/applications/service";

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createApplicationAction(
  _previousState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const workspace = await getDefaultWorkspace();
  const parsed = createApplicationSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: "Please fix the highlighted fields and try again."
    };
  }

  try {
    const application = await createApplication(workspace.id, parsed.data);
    revalidatePath("/applications");
    redirect(`/applications/${application.id}?success=created`);
  } catch (error) {
    return {
      fieldErrors:
        error instanceof ApplicationSubmissionError ? error.fieldErrors : undefined,
      formError:
        error instanceof Error
          ? error.message
          : "The application could not be saved."
    };
  }
}

export async function updateApplicationAction(
  applicationId: string,
  _previousState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const workspace = await getDefaultWorkspace();
  const parsed = updateApplicationSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: "Please fix the highlighted fields and try again."
    };
  }

  try {
    await updateApplication(workspace.id, applicationId, parsed.data);
    revalidatePath("/applications");
    revalidatePath(`/applications/${applicationId}`);
    redirect(`/applications/${applicationId}?success=updated`);
  } catch (error) {
    return {
      fieldErrors:
        error instanceof ApplicationSubmissionError ? error.fieldErrors : undefined,
      formError:
        error instanceof Error
          ? error.message
          : "The application could not be updated."
    };
  }
}

export async function archiveApplicationAction(applicationId: string) {
  const workspace = await getDefaultWorkspace();
  await archiveApplication(workspace.id, applicationId);
  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  redirect("/applications?success=archived");
}

export async function restoreApplicationAction(applicationId: string) {
  const workspace = await getDefaultWorkspace();
  await restoreApplication(workspace.id, applicationId);
  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  redirect(`/applications/${applicationId}?success=restored`);
}
