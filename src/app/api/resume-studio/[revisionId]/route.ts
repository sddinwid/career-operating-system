import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { saveResumeRevisionDraft } from "@/lib/resume-revision/service";
import { resumeRevisionSavePayloadSchema } from "@/lib/resume-revision/contract";
import { getDefaultWorkspace } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ revisionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { revisionId } = await context.params;

  try {
    const body = await request.json();
    const payload = resumeRevisionSavePayloadSchema.parse({
      ...body,
      revisionId
    });
    const saved = await saveResumeRevisionDraft(workspace.id, payload);
    return NextResponse.json({
      revisionId: saved?.id,
      updatedAt: saved?.updatedAt.toISOString(),
      status: saved?.status,
      summary: saved?.summary
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid resume revision payload.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.name === "ResumeRevisionConflictError") {
      return NextResponse.json(
        {
          error:
            "This draft was updated elsewhere. Refresh the Studio to compare before saving again."
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save resume revision draft."
      },
      { status: 500 }
    );
  }
}
