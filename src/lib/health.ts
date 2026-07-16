import { prisma } from "@/lib/prisma";

export type HealthStatus = {
  application: "ok";
  database: "ok" | "error";
  checkedAt: string;
  details?: string;
};

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      application: "ok",
      database: "ok",
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      application: "ok",
      database: "error",
      checkedAt: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Unknown database error"
    };
  }
}
