"use server";

import { redirect } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  createFixtureImportPreview,
  retryImportJobFailures,
  runImportJob
} from "@/lib/imports/service";
import {
  importFieldDefinitions,
  type FieldMapping,
  type ImportFieldId
} from "@/lib/imports/types";

function readFieldMapping(formData: FormData): FieldMapping {
  const mapping: FieldMapping = {};

  for (const definition of importFieldDefinitions) {
    const value = formData.get(definition.id);
    if (typeof value === "string" && value.trim()) {
      mapping[definition.id as ImportFieldId] = value.trim();
    }
  }

  return mapping;
}

export async function prepareFixtureImportPreviewAction(formData: FormData) {
  const workspace = await getDefaultWorkspace();
  const mapping = readFieldMapping(formData);
  const jobId = await createFixtureImportPreview(workspace.id, mapping);
  redirect(`/imports?jobId=${jobId}&success=preview`);
}

export async function confirmFixtureImportAction(formData: FormData) {
  const workspace = await getDefaultWorkspace();
  const jobId = formData.get("jobId");

  if (typeof jobId !== "string" || !jobId) {
    throw new Error("Import job id is required.");
  }

  await runImportJob(workspace.id, jobId);
  redirect(`/imports?jobId=${jobId}&success=imported`);
}

export async function retryFixtureImportRowsAction(formData: FormData) {
  const workspace = await getDefaultWorkspace();
  const jobId = formData.get("jobId");

  if (typeof jobId !== "string" || !jobId) {
    throw new Error("Import job id is required.");
  }

  await retryImportJobFailures(workspace.id, jobId);
  redirect(`/imports?jobId=${jobId}&success=retried`);
}
