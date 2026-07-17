"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";

export async function parseJobDescriptionAction(
  jobDescriptionVersionId: string,
  returnTo?: string
) {
  const workspace = await getDefaultWorkspace();
  const result = await parseStoredJobDescriptionVersion(workspace.id, jobDescriptionVersionId);

  const target = returnTo ?? `/job-descriptions/${jobDescriptionVersionId}`;
  const status =
    result.parse.status === "FAILED"
      ? "parse-failed"
      : result.duplicate
        ? "parse-reused"
        : "parse-created";

  revalidatePath("/applications");
  revalidatePath(target);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/analysis`);

  const destination = `${target}?parse=${status}` as Parameters<typeof redirect>[0];
  redirect(destination);
}
