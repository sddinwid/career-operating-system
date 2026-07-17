import { NextResponse } from "next/server";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  applicationsGridPreferencesCommandSchema
} from "@/lib/applications/grid-view-state";
import {
  ApplicationsGridPreferencesError,
  mutateApplicationsGridPreferences
} from "@/lib/applications/grid-view-service";

export async function POST(request: Request) {
  const workspace = await getDefaultWorkspace();
  const payload = await request.json().catch(() => null);
  const parsed = applicationsGridPreferencesCommandSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please fix the saved view request and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors
      },
      {
        status: 400
      }
    );
  }

  try {
    const result = await mutateApplicationsGridPreferences(
      workspace.id,
      parsed.data
    );

    return NextResponse.json({
      ok: true,
      preferences: result.preferences,
      warning: result.warning
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof ApplicationsGridPreferencesError
            ? error.message
            : "The saved view request could not be completed."
      },
      {
        status: error instanceof ApplicationsGridPreferencesError ? 400 : 500
      }
    );
  }
}
