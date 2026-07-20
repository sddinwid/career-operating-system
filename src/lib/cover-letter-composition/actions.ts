"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCoverLetterComposition } from "@/lib/cover-letter-composition/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function createCoverLetterCompositionAction(
  matchReportRunId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await createCoverLetterComposition(workspace.id, {
    matchReportRunId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/cover-letter`;
  const status = result.duplicate ? "cover-letter-reused" : "cover-letter-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.version?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/match-report`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/cover-letter`);

  const separator = target.includes("?") ? "&" : "?";
  const destination = `${target}${separator}versionId=${result.version?.id}&success=${status}`;
  redirect(destination as Parameters<typeof redirect>[0]);
}
