import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { coverLetterRevisionSavePayloadSchema } from "@/lib/cover-letter-revision/contract";
import {
  CoverLetterRevisionServiceError,
  saveCoverLetterRevisionSuccessor
} from "@/lib/cover-letter-revision/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ revisionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { revisionId } = await context.params;

  try {
    const body = await request.json();
    const payload = coverLetterRevisionSavePayloadSchema.parse({
      ...body,
      revisionId
    });
    const saved = await saveCoverLetterRevisionSuccessor(workspace.id, payload);
    return NextResponse.json({
      revisionId: saved?.id,
      inputChecksum: saved?.inputChecksum,
      updatedAt: saved?.updatedAt.toISOString(),
      status: saved?.status,
      summary: saved?.summary
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid cover-letter revision payload.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    if (error instanceof CoverLetterRevisionServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save cover-letter revision."
      },
      { status: 500 }
    );
  }
}
