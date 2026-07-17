import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  approveResumeForRendering,
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory,
  ResumeRenderingApprovalServiceError
} from "@/lib/resume-rendering-approval/service";

export async function POST(request: Request) {
  const workspace = await getDefaultWorkspace();

  try {
    const body = await request.json();
    const result = await approveResumeForRendering(workspace.id, body);
    const approval = result.approval;

    return NextResponse.json({
      approval,
      duplicate: result.duplicate,
      activeApproval: await getActiveResumeRenderingApproval(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId
      }),
      history: await listResumeRenderingApprovalHistory(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId
      }),
      eligibility: await getResumeRenderingApprovalEligibility(workspace.id, {
        jobDescriptionVersionId: approval.jobDescriptionVersionId,
        applicationId: approval.applicationId,
        sourceType: approval.sourceType,
        sourceId: approval.sourceId,
        resumeAuditRunId: approval.resumeAuditRunId
      })
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid rendering approval payload.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    if (error instanceof ResumeRenderingApprovalServiceError) {
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
        error: error instanceof Error ? error.message : "Failed to create rendering approval."
      },
      { status: 500 }
    );
  }
}
