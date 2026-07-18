-- CreateEnum
CREATE TYPE "DocumentRenderStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "jobDescriptionVersionId" TEXT;

-- AlterTable
ALTER TABLE "DocumentVersion"
ADD COLUMN "workspaceId" TEXT,
ADD COLUMN "applicationId" TEXT,
ADD COLUMN "jobDescriptionVersionId" TEXT,
ADD COLUMN "resumeRenderingApprovalId" TEXT,
ADD COLUMN "resumeAuditRunId" TEXT,
ADD COLUMN "resumeCompositionVersionId" TEXT,
ADD COLUMN "resumeRevisionVersionId" TEXT,
ADD COLUMN "renderStatus" "DocumentRenderStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "renderContractVersion" TEXT,
ADD COLUMN "rendererVersion" TEXT,
ADD COLUMN "templateVersion" TEXT,
ADD COLUMN "configurationVersion" TEXT,
ADD COLUMN "renderInputChecksum" TEXT,
ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "validationSummary" JSONB,
ADD COLUMN "errorSummary" TEXT;

-- Backfill on the foundation-only table shape before enforcing NOT NULL lineage.
UPDATE "DocumentVersion"
SET
  "workspaceId" = "Document"."workspaceId",
  "applicationId" = "Document"."applicationId"
FROM "Document"
WHERE "DocumentVersion"."documentId" = "Document"."id";

ALTER TABLE "DocumentVersion"
ALTER COLUMN "workspaceId" SET NOT NULL,
ALTER COLUMN "jobDescriptionVersionId" SET NOT NULL,
ALTER COLUMN "resumeRenderingApprovalId" SET NOT NULL,
ALTER COLUMN "resumeAuditRunId" SET NOT NULL,
ALTER COLUMN "resumeCompositionVersionId" SET NOT NULL,
ALTER COLUMN "renderContractVersion" SET NOT NULL,
ALTER COLUMN "rendererVersion" SET NOT NULL,
ALTER COLUMN "templateVersion" SET NOT NULL,
ALTER COLUMN "configurationVersion" SET NOT NULL,
ALTER COLUMN "renderInputChecksum" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_jobDescriptionVersionId_createdAt_idx" ON "Document"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "DocumentVersion_workspaceId_generatedAt_idx" ON "DocumentVersion"("workspaceId", "generatedAt");
CREATE INDEX "DocumentVersion_applicationId_generatedAt_idx" ON "DocumentVersion"("applicationId", "generatedAt");
CREATE INDEX "DocumentVersion_jobDescriptionVersionId_generatedAt_idx" ON "DocumentVersion"("jobDescriptionVersionId", "generatedAt");
CREATE INDEX "DocumentVersion_resumeRenderingApprovalId_generatedAt_idx" ON "DocumentVersion"("resumeRenderingApprovalId", "generatedAt");
CREATE INDEX "DocumentVersion_resumeAuditRunId_generatedAt_idx" ON "DocumentVersion"("resumeAuditRunId", "generatedAt");
CREATE INDEX "DocumentVersion_resumeCompositionVersionId_generatedAt_idx" ON "DocumentVersion"("resumeCompositionVersionId", "generatedAt");
CREATE INDEX "DocumentVersion_resumeRevisionVersionId_generatedAt_idx" ON "DocumentVersion"("resumeRevisionVersionId", "generatedAt");
CREATE INDEX "DocumentVersion_workspaceId_renderInputChecksum_renderStatus_generatedAt_idx" ON "DocumentVersion"("workspaceId", "renderInputChecksum", "renderStatus", "generatedAt");

-- AddForeignKey
ALTER TABLE "Document"
ADD CONSTRAINT "Document_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_resumeRenderingApprovalId_fkey"
FOREIGN KEY ("resumeRenderingApprovalId") REFERENCES "ResumeRenderingApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_resumeAuditRunId_fkey"
FOREIGN KEY ("resumeAuditRunId") REFERENCES "ResumeAuditRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_resumeCompositionVersionId_fkey"
FOREIGN KEY ("resumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
ADD CONSTRAINT "DocumentVersion_resumeRevisionVersionId_fkey"
FOREIGN KEY ("resumeRevisionVersionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
