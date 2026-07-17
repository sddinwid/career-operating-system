import { NextResponse } from "next/server";
import { updateApplicationGridFieldSchema } from "@/lib/applications/grid-schemas";
import {
  ApplicationSubmissionError,
  updateApplicationGridField
} from "@/lib/applications/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type GridFieldRouteContext = {
  params: Promise<{
    applicationId: string;
  }>;
};

export async function POST(request: Request, context: GridFieldRouteContext) {
  const workspace = await getDefaultWorkspace();
  const { applicationId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = updateApplicationGridFieldSchema.safeParse({
    applicationId,
    field: payload?.field,
    value: payload?.value ?? null
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please fix the edited value and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const row = await updateApplicationGridField(workspace.id, parsed.data);

    return NextResponse.json({
      ok: true,
      row,
      message: "Application updated."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The application could not be updated.",
        fieldErrors:
          error instanceof ApplicationSubmissionError ? error.fieldErrors : undefined
      },
      {
        status: error instanceof ApplicationSubmissionError ? 400 : 500
      }
    );
  }
}
