"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { scoreRetrievedEvidence } from "@/lib/evidence-scoring/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function scoreRetrievedEvidenceAction(
  evidenceRetrievalRunId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await scoreRetrievedEvidence(workspace.id, {
    evidenceRetrievalRunId
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/evidence/scores`;
  const status = result.duplicate ? "scoring-reused" : "scoring-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.run?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/requirements`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/evidence`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/evidence/scores`);

  const separator = target.includes("?") ? "&" : "?";
  const destination = target.includes("/evidence/scores")
    ? `${target}${separator}runId=${result.run?.id}&retrievalRunId=${evidenceRetrievalRunId}&success=${status}`
    : `${target}${separator}retrievalRunId=${evidenceRetrievalRunId}&scoringRunId=${result.run?.id}&success=${status}`;

  redirect(destination as Parameters<typeof redirect>[0]);
}
