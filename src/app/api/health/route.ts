import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export async function GET() {
  const status = await getHealthStatus();
  const httpStatus = status.database === "ok" ? 200 : 503;

  return NextResponse.json(status, { status: httpStatus });
}
