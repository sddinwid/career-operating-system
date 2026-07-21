const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const app = await prisma.application.findFirst({
    where: {
      workspaceId: "local-workspace",
      opportunity: {
        title: "E2E Grid Role",
        company: { name: "E2E Grid Company" }
      }
    },
    select: { id: true }
  });
  const runs = await prisma.coverLetterAuditRun.findMany({
    where: { applicationId: app ? app.id : undefined },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 2,
    select: {
      id: true,
      sourceType: true,
      coverLetterRevisionVersionId: true,
      renderingReadiness: true,
      summary: true,
      result: true
    }
  });
  console.log(JSON.stringify({ app, runs }, null, 2));
  await prisma["$disconnect"]();
})().catch(async (error) => {
  console.error(error);
  await prisma["$disconnect"]();
  process.exit(1);
});
