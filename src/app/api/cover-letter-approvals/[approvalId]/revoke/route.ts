import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  CoverLetterApprovalServiceError,
  getActiveCoverLetterApproval,
  getCoverLetterApprovalEligibility,
  listCoverLetterApprovalHistory,
  revokeCoverLetterApproval
} from "@/lib/cover-letter-approval/service";

type RouteContext = {
  params: Promise<{ approvalId: string }>;
};

const payloadSchema = z.object({
  approvalId: z.string().min(1),
  expectedActiveApprovalId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable().optional(),
  sourceType: z.enum(["BASE_COMPOSITION", "FINALIZED_REVISION"]),
  sourceId: z.string().min(1),
  coverLetterAuditRunId: z.string().min(1).nullable()
});

export async function POST(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { approvalId } = await context.params;

  try {
    const body = payloadSchema.parse(await request.json());
    await revokeCoverLetterApproval(workspace.id, {
      approvalId,
      expectedActiveApprovalId: body.expectedActiveApprovalId,
      reason: body.reason
    });

    return NextResponse.json({
      activeApproval: await getActiveCoverLetterApproval(workspace.id, {
        jobDescriptionVersionId: body.jobDescriptionVersionId,
        applicationId: body.applicationId ?? null
      }),
      history: await listCoverLetterApprovalHistory(workspace.id, {
        jobDescriptionVersionId: body.jobDescriptionVersionId,
        applicationId: body.applicationId ?? null
      }),
      eligibility: body.coverLetterAuditRunId
        ? await getCoverLetterApprovalEligibility(workspace.id, {
            jobDescriptionVersionId: body.jobDescriptionVersionId,
            applicationId: body.applicationId ?? null,
            sourceType: body.sourceType,
            sourceId: body.sourceId,
            coverLetterAuditRunId: body.coverLetterAuditRunId
          })
        : null
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid cover-letter approval revoke payload.",
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
        error: error instanceof Error ? error.message : "Failed to revoke the cover-letter approval."
      },
      { status: 500 }
    );
  }
}
