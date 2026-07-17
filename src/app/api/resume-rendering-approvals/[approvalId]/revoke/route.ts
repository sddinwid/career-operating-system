import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  getActiveResumeRenderingApproval,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory,
  ResumeRenderingApprovalServiceError,
  revokeResumeRenderingApproval
} from "@/lib/resume-rendering-approval/service";

type RouteContext = {
  params: Promise<{ approvalId: string }>;
};

const payloadSchema = z.object({
  approvalId: z.string().min(1),
  expectedActiveApprovalId: z.string().min(1).nullable().optional(),
  reason: z.string().nullable().optional(),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable().optional(),
  sourceType: z.enum(["BASE_COMPOSITION", "FINALIZED_REVISION"]),
  sourceId: z.string().min(1),
  resumeAuditRunId: z.string().min(1).nullable()
});

export async function POST(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { approvalId } = await context.params;

  try {
    const body = payloadSchema.parse(await request.json());
    await revokeResumeRenderingApproval(workspace.id, {
      approvalId,
      expectedActiveApprovalId: body.expectedActiveApprovalId,
      reason: body.reason
    });

    return NextResponse.json({
      activeApproval: await getActiveResumeRenderingApproval(workspace.id, {
        jobDescriptionVersionId: body.jobDescriptionVersionId,
        applicationId: body.applicationId ?? null
      }),
      history: await listResumeRenderingApprovalHistory(workspace.id, {
        jobDescriptionVersionId: body.jobDescriptionVersionId,
        applicationId: body.applicationId ?? null
      }),
      eligibility: body.resumeAuditRunId
        ? await getResumeRenderingApprovalEligibility(workspace.id, {
            jobDescriptionVersionId: body.jobDescriptionVersionId,
            applicationId: body.applicationId ?? null,
            sourceType: body.sourceType,
            sourceId: body.sourceId,
            resumeAuditRunId: body.resumeAuditRunId
          })
        : null
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid rendering approval revoke payload.",
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
        error: error instanceof Error ? error.message : "Failed to revoke rendering approval."
      },
      { status: 500 }
    );
  }
}
