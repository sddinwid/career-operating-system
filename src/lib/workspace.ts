import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getDefaultWorkspace = cache(async () => {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (!workspace) {
    throw new Error("No workspace is available. Run the seed script first.");
  }

  return workspace;
});
