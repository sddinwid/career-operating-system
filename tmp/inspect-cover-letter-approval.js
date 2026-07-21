const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const app = await prisma.application.findFirst({
    where: {
      workspaceId: "local-workspace",
      opportunity: { title: "E2E Grid Role", company: { name: "E2E Grid Company" } }
    },
    select: { id: true, currentJobDescriptionVersionId: true }
  });
  const approvals = await prisma.coverLetterApproval.findMany({
    where: { applicationId: app ? app.id : undefined },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      sourceType: true,
      status: true,
      coverLetterRevisionVersionId: true,
      coverLetterAuditRunId: true,
      warningAcknowledged: true,
      warningCount: true,
      blockingCount: true,
      predecessorApprovalId: true,
      createdAt: true,
      revokedAt: true,
      supersededAt: true
    }
  });
  console.log(JSON.stringify({ app, approvals }, null, 2));
  await prisma["$disconnect"]();
})().catch(async (error) => {
  console.error(error);
  await prisma["$disconnect"]();
  process.exit(1);
});
