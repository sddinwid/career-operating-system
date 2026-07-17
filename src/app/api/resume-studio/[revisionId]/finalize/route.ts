import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { finalizeResumeRevision } from "@/lib/resume-revision/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ revisionId: string }>;
};

const payloadSchema = z.object({
  updatedAt: z.string().datetime(),
  returnTo: z.string().min(1)
});

function getDomainErrorDetails(error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return {
      status: error.status,
      code: error.code,
      message: error.message
    };
  }

  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { revisionId } = await context.params;

  try {
    const body = payloadSchema.parse(await request.json());
    const finalized = await finalizeResumeRevision(
      workspace.id,
      {
        revisionId,
        updatedAt: body.updatedAt
      }
    );

    return NextResponse.json({
      revisionId: finalized?.id,
      status: finalized?.status,
      redirectTo: `${body.returnTo}?revisionId=${finalized?.id}&success=revision-finalized`
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid resume revision finalize payload.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    const domainError = getDomainErrorDetails(error);
    if (domainError) {
      return NextResponse.json(
        {
          error:
            domainError.code === "STALE_DRAFT"
              ? "This draft was updated elsewhere. Refresh the Studio to compare before finalizing."
              : domainError.message,
          code: domainError.code
        },
        { status: domainError.status }
      );
    }

    console.error("Resume revision finalization failed.", {
      revisionId,
      workspaceId: workspace.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });

    return NextResponse.json(
      {
        error: "Failed to finalize resume revision."
      },
      { status: 500 }
    );
  }
}
