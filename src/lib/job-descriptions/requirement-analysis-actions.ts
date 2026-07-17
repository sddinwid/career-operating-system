"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requirementCategorySchema
} from "@/lib/job-descriptions/requirement-analysis-contract";
import {
  addUserRequirementToAnalysis,
  applyRequirementAnalysisBulkAction,
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  excludeRequirementAnalysisItem,
  parseRequirementKinds,
  RequirementAnalysisSubmissionError,
  updateRequirementAnalysisRequirement,
  updateRequirementAnalysisResponsibility
} from "@/lib/job-descriptions/requirement-analysis-service";
import { getDefaultWorkspace } from "@/lib/workspace";

const bulkActionSchema = z.enum([
  "confirm-high-confidence",
  "exclude-noise",
  "restore-excluded"
]);

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function getMessageRoute(args: {
  jobDescriptionVersionId: string;
  success?: string;
  error?: string;
  analysisId?: string | null;
}): Route {
  const params = new URLSearchParams();
  if (args.analysisId) {
    params.set("analysisId", args.analysisId);
  }
  if (args.success) {
    params.set("success", args.success);
  }
  if (args.error) {
    params.set("error", args.error);
  }

  const query = params.toString();
  return (query
    ? `/job-descriptions/${args.jobDescriptionVersionId}/requirements?${query}`
    : `/job-descriptions/${args.jobDescriptionVersionId}/requirements`) as Route;
}

function trimOptional(value: FormDataEntryValue | null) {
  const trimmed = value?.toString().trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function getKinds(formData: FormData) {
  return parseRequirementKinds(
    formData.getAll("kinds").map((value) => value.toString())
  );
}

function handleActionError(
  error: unknown,
  jobDescriptionVersionId: string,
  analysisId?: string | null
): never {
  if (isNextRedirectError(error)) {
    throw error;
  }

  const message =
    error instanceof RequirementAnalysisSubmissionError || error instanceof Error
      ? error.message
      : "The requirement analysis could not be updated.";

  redirect(
    getMessageRoute({
      jobDescriptionVersionId,
      analysisId,
      error: message
    })
  );
}

async function revalidateRequirementPaths(jobDescriptionVersionId: string) {
  revalidatePath("/applications");
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/analysis`);
  revalidatePath(`/job-descriptions/${jobDescriptionVersionId}/requirements`);
}

export async function saveRequirementReviewAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    const requirementId = z.string().min(1).parse(formData.get("requirementId"));
    const category = requirementCategorySchema.parse(formData.get("category"));
    const kinds = getKinds(formData);

    await updateRequirementAnalysisRequirement(workspace.id, analysisId, {
      requirementId,
      category,
      kinds,
      note: trimOptional(formData.get("reviewNote")),
      correctedDisplayText: trimOptional(formData.get("correctedDisplayText")),
      confirmed: formData.get("confirmed") === "on"
    });

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: "requirement-saved"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function saveResponsibilityReviewAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    const responsibilityId = z.string().min(1).parse(formData.get("responsibilityId"));
    const kinds = getKinds(formData);

    await updateRequirementAnalysisResponsibility(workspace.id, analysisId, {
      responsibilityId,
      kinds,
      note: trimOptional(formData.get("reviewNote")),
      confirmed: formData.get("confirmed") === "on"
    });

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: "responsibility-saved"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function toggleRequirementExclusionAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    const itemType = z.enum(["requirement", "responsibility"]).parse(formData.get("itemType"));
    const itemId = z.string().min(1).parse(formData.get("itemId"));
    const excluded = z.enum(["true", "false"]).parse(formData.get("excluded")) === "true";

    await excludeRequirementAnalysisItem(workspace.id, analysisId, {
      itemType,
      itemId,
      excluded
    });

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: excluded ? "item-excluded" : "item-restored"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function addUserRequirementAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    const text = z.string().min(1).parse(formData.get("text"));
    const category = requirementCategorySchema.parse(formData.get("category"));
    const kinds = getKinds(formData);
    const technologies = (trimOptional(formData.get("technologies")) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    await addUserRequirementToAnalysis(workspace.id, analysisId, {
      text,
      category,
      kinds,
      technologies,
      experienceText: trimOptional(formData.get("experienceText")),
      reviewNote: trimOptional(formData.get("reviewNote"))
    });

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: "user-requirement-added"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function applyRequirementBulkAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    const action = bulkActionSchema.parse(formData.get("action"));
    await applyRequirementAnalysisBulkAction(workspace.id, analysisId, action);

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: `bulk-${action}`
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function confirmRequirementAnalysisAction(
  jobDescriptionVersionId: string,
  analysisId: string,
  formData: FormData
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    await confirmRequirementAnalysis(
      workspace.id,
      analysisId,
      formData.get("acknowledgeLowConfidence") === "on"
    );

    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: "analysis-confirmed"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId);
  }
}

export async function createRevisedRequirementAnalysisAction(
  jobDescriptionVersionId: string,
  analysisId: string
): Promise<never> {
  const workspace = await getDefaultWorkspace();

  try {
    await createRevisedRequirementAnalysis(workspace.id, analysisId);
    await revalidateRequirementPaths(jobDescriptionVersionId);
    redirect(
      getMessageRoute({
        jobDescriptionVersionId,
        success: "analysis-revised"
      })
    );
  } catch (error) {
    handleActionError(error, jobDescriptionVersionId, analysisId);
  }
}
