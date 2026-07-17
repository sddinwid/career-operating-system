"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import { runResumeAudit } from "@/lib/resume-audit/service";

export async function runResumeAuditAction(
  resumeCompositionVersionId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await runResumeAudit(workspace.id, {
    resumeCompositionVersionId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/resume/audit`;
  const status = result.duplicate ? "audit-reused" : "audit-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.run?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume/audit`);

  const separator = target.includes("?") ? "&" : "?";
  redirect(`${target}${separator}runId=${result.run?.id}&success=${status}` as Parameters<typeof redirect>[0]);
}
