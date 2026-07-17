"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import { generateMatchReport } from "@/lib/match-report/service";

export async function generateMatchReportAction(
  evidenceScoringRunId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await generateMatchReport(workspace.id, {
    evidenceScoringRunId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/match-report`;
  const status = result.duplicate ? "report-reused" : "report-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.run?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/requirements`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/evidence`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/evidence/scores`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/match-report`);

  const separator = target.includes("?") ? "&" : "?";
  const destination = target.includes("/match-report")
    ? `${target}${separator}runId=${result.run?.id}&scoringRunId=${evidenceScoringRunId}&success=${status}`
    : `${target}${separator}matchReportRunId=${result.run?.id}&success=${status}`;

  redirect(destination as Parameters<typeof redirect>[0]);
}
