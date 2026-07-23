import { NextResponse } from "next/server";
import {
  jobDescriptionFetchRequestSchema,
  jobDescriptionFetchResponseSchema
} from "@/lib/job-descriptions/url-fetch-contract";
import {
  fetchJobDescriptionFromUrl,
  JobDescriptionUrlFetchError
} from "@/lib/job-descriptions/url-fetch";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = jobDescriptionFetchRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please provide a valid public URL.",
        fieldErrors: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const result = await fetchJobDescriptionFromUrl(parsed.data.url, {
      allowRenderedFallback: parsed.data.allowRenderedFallback
    });
    const response = jobDescriptionFetchResponseSchema.parse(result);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof JobDescriptionUrlFetchError) {
      return NextResponse.json(
        {
          error: error.message,
          diagnostics: error.diagnostics,
          retryableWithRenderedFallback: error.status === 409
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: "The job posting could not be fetched right now."
      },
      { status: 502 }
    );
  }
}
