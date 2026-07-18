"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderApprovedResumeDocument } from "@/lib/document-rendering/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function renderApprovedResumeDocumentAction(
  jobDescriptionVersionId: string,
  applicationId?: string | null,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await renderApprovedResumeDocument(workspace.id, {
    jobDescriptionVersionId,
    applicationId: applicationId ?? null
  });

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}/resume`;
  const status = result.duplicate ? "document-reused" : "document-rendered";

  revalidatePath("/applications");
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
  revalidatePath(`/documents/${result.documentVersion?.id ?? ""}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume/audit`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/resume/compare`);

  const separator = target.includes("?") ? "&" : "?";
  redirect(
    `${target}${separator}documentVersionId=${result.documentVersion?.id}&success=${status}` as Parameters<
      typeof redirect
    >[0]
  );
}
