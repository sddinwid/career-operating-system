import { NextResponse } from "next/server";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  buildContentDisposition,
  DocumentRenderingArtifactError,
  readDocumentVersionFile
} from "@/lib/document-rendering/service";

type RouteProps = {
  params: Promise<{ documentVersionId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { documentVersionId } = await params;
    const workspace = await getDefaultWorkspace();
    const { version, buffer } = await readDocumentVersionFile(workspace.id, documentVersionId);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": version.mimeType,
        "Content-Disposition": buildContentDisposition(version.originalFilename),
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof DocumentRenderingArtifactError) {
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
        error: "Unexpected download failure.",
        code: "DOCUMENT_DOWNLOAD_FAILED"
      },
      { status: 500 }
    );
  }
}
