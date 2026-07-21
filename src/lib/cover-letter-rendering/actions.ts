"use server";

import { DocumentFormat } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { renderApprovedCoverLetterDocument } from "@/lib/cover-letter-rendering/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export async function renderApprovedCoverLetterDocumentAction(
  jobDescriptionVersionId: string,
  format: DocumentFormat,
  applicationId: string | null | undefined,
  redirectPath: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await renderApprovedCoverLetterDocument(workspace.id, {
    jobDescriptionVersionId,
    applicationId,
    format
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${result.documentVersion?.id ?? ""}`);
  revalidatePath(`/applications/${applicationId ?? ""}`);
  revalidatePath(`/jobs`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/cover-letter`);

  const success =
    format === DocumentFormat.PDF
      ? result.duplicate
        ? "cover-letter-pdf-document-reused"
        : "cover-letter-pdf-document-rendered"
      : result.duplicate
        ? "cover-letter-docx-document-reused"
        : "cover-letter-docx-document-rendered";

  redirect(`${redirectPath}?success=${success}`);
}
