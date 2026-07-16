import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export async function GET() {
  const status = await getHealthStatus();
  const payload = {
    database: status.database,
    checkedAt: status.checkedAt,
    details: status.details
  };

  return NextResponse.json(payload, {
    status: status.database === "ok" ? 200 : 503
  });
}
