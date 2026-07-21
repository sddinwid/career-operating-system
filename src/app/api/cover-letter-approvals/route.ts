import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  approveCoverLetterRevision,
  CoverLetterApprovalServiceError,
  getActiveCoverLetterApproval,
  getCoverLetterApprovalEligibility,
  listCoverLetterApprovalHistory
} from "@/lib/cover-letter-approval/service";

export async function POST(request: Request) {
  const workspace = await getDefaultWorkspace();

  try {
    const body = await request.json();
    const result = await approveCoverLetterRevision(workspace.id, body);
    const approval = result.approval;

    return NextResponse.json({
      approval,
      duplicate: result.duplicate,
      activeApproval: await getActiveCoverLetterApproval(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId
      }),
      history: await listCoverLetterApprovalHistory(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId
      }),
      eligibility: await getCoverLetterApprovalEligibility(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId,
        sourceType: approval.sourceType,
        sourceId: approval.sourceId,
        coverLetterAuditRunId: approval.coverLetterAuditRunId
      })
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid cover-letter approval payload.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    if (error instanceof CoverLetterApprovalServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          diagnostics: error.diagnostics ?? []
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to approve the cover letter."
      },
      { status: 500 }
    );
  }
}
