import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import {
  CoverLetterRevisionServiceError,
  finalizeCoverLetterRevision
} from "@/lib/cover-letter-revision/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{ revisionId: string }>;
};

const payloadSchema = z.object({
  updatedAt: z.string().datetime(),
  returnTo: z.string().min(1)
});

export async function POST(request: Request, context: RouteContext) {
  const workspace = await getDefaultWorkspace();
  const { revisionId } = await context.params;

  try {
    const body = payloadSchema.parse(await request.json());
    const finalized = await finalizeCoverLetterRevision(workspace.id, {
      revisionId,
      updatedAt: body.updatedAt
    });

    return NextResponse.json({
      revisionId: finalized?.id,
      status: finalized?.status,
      redirectTo: `${body.returnTo}?revisionId=${finalized?.id}&success=revision-finalized`
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid cover-letter revision finalize payload.",
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
        error: "Failed to finalize cover-letter revision."
      },
      { status: 500 }
    );
  }
}
