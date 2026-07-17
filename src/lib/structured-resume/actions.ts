"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import { createStructuredResumePlan } from "@/lib/structured-resume/service";

export async function createStructuredResumePlanAction(
  matchReportRunId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await createStructuredResumePlan(workspace.id, {
    matchReportRunId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/resume-plan`;
  const status = result.duplicate ? "plan-reused" : "plan-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.version?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/match-report`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume-plan`);

  const separator = target.includes("?") ? "&" : "?";
  const destination = target.includes("/resume-plan")
    ? `${target}${separator}versionId=${result.version?.id}&matchReportRunId=${matchReportRunId}&success=${status}`
    : `${target}${separator}structuredResumeVersionId=${result.version?.id}&success=${status}`;

  redirect(destination as Parameters<typeof redirect>[0]);
}
