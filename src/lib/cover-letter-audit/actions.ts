"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runCoverLetterAudit } from "@/lib/cover-letter-audit/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function runCoverLetterAuditAction(
  sourceType: "BASE_COMPOSITION" | "FINALIZED_REVISION",
  sourceId: string,
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await runCoverLetterAudit(workspace.id, { sourceType, sourceId });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/cover-letter/audit`;
  const status = result.duplicate ? "audit-reused" : "audit-created";

  revalidatePath("/applications");
  revalidatePath(`/applications/${result.run?.applicationId ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/cover-letter`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/cover-letter/audit`);

  const separator = target.includes("?") ? "&" : "?";
  redirect(
    `${target}${separator}runId=${result.run?.id}&sourceType=${sourceType}&sourceId=${sourceId}&success=${status}` as Parameters<
      typeof redirect
    >[0]
  );
}
