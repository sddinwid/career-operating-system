"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createResumeComposition } from "@/lib/resume-composition/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function createResumeCompositionAction(
  structuredResumeVersionId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await createResumeComposition(workspace.id, {
    structuredResumeVersionId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/resume`;
  const status = result.duplicate ? "composition-reused" : "composition-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.version?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume-plan`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume`);

  const separator = target.includes("?") ? "&" : "?";
  const destination = `${target}${separator}versionId=${result.version?.id}&success=${status}`;
  redirect(destination as Parameters<typeof redirect>[0]);
}
