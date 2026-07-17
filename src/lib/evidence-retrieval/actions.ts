"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function retrieveCareerEvidenceAction(
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await retrieveCareerEvidence(workspace.id, {
    jobDescriptionVersionId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/evidence`;
  const status = result.duplicate ? "retrieval-reused" : "retrieval-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.run?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/analysis`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/requirements`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/evidence`);

  const separator = target.includes("?") ? "&" : "?";
  const destination =
    `${target}${separator}runId=${result.run?.id}&success=${status}` as Parameters<typeof redirect>[0];
  redirect(destination);
}
