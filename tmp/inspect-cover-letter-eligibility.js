const { PrismaClient } = require("@prisma/client");
const { getCoverLetterApprovalEligibility } = require("../src/lib/cover-letter-approval/service");
const prisma = new PrismaClient();
(async () => {
  const app = await prisma.application.findFirst({
    where: { workspaceId: "local-workspace", opportunity: { title: "E2E Grid Role", company: { name: "E2E Grid Company" } } },
    select: { id: true, currentJobDescriptionVersionId: true }
  });
  const run = await prisma.coverLetterAuditRun.findFirst({
    where: { applicationId: app.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, coverLetterRevisionVersionId: true }
  });
  const eligibility = await getCoverLetterApprovalEligibility("local-workspace", {
    jobDescriptionVersionId: app.currentJobDescriptionVersionId,
    applicationId: app.id,
    sourceType: "FINALIZED_REVISION",
    sourceId: run.coverLetterRevisionVersionId,
    coverLetterAuditRunId: run.id
  }, prisma);
  console.log(JSON.stringify({ app, run, eligibility }, null, 2));
  await prisma["$disconnect"]();
})().catch(async (error) => {
  console.error(error);
  await prisma["$disconnect"]();
  process.exit(1);
});
