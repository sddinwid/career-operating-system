-- CreateEnum
CREATE TYPE "ResumeRevisionVersionStatus" AS ENUM (
  'DRAFT',
  'READY_FOR_AUDIT',
  'AUDITED',
  'NEEDS_REVIEW',
  'SUPERSEDED',
  'FAILED'
);

-- CreateTable
CREATE TABLE "ResumeRevisionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "baseResumeCompositionVersionId" TEXT NOT NULL,
  "predecessorRevisionId" TEXT,
  "structuredResumeVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "sourceInputChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "ResumeRevisionVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "content" JSONB,
  "changeSet" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "reviewNotes" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finalizedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "ResumeRevisionVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ResumeAuditRun"
ADD COLUMN "resumeRevisionVersionId" TEXT;

-- Indexes
CREATE INDEX "ResumeRevisionVersion_workspaceId_createdAt_idx" ON "ResumeRevisionVersion"("workspaceId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_workspaceId_updatedAt_idx" ON "ResumeRevisionVersion"("workspaceId", "updatedAt");
CREATE INDEX "ResumeRevisionVersion_baseResumeCompositionVersionId_createdAt_idx" ON "ResumeRevisionVersion"("baseResumeCompositionVersionId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_predecessorRevisionId_createdAt_idx" ON "ResumeRevisionVersion"("predecessorRevisionId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_structuredResumeVersionId_createdAt_idx" ON "ResumeRevisionVersion"("structuredResumeVersionId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_careerProfileVersionId_createdAt_idx" ON "ResumeRevisionVersion"("careerProfileVersionId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_matchReportRunId_createdAt_idx" ON "ResumeRevisionVersion"("matchReportRunId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_requirementAnalysisId_createdAt_idx" ON "ResumeRevisionVersion"("requirementAnalysisId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_jobDescriptionVersionId_createdAt_idx" ON "ResumeRevisionVersion"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_applicationId_createdAt_idx" ON "ResumeRevisionVersion"("applicationId", "createdAt");
CREATE INDEX "ResumeRevisionVersion_workspaceId_inputChecksum_status_createdAt_idx" ON "ResumeRevisionVersion"("workspaceId", "inputChecksum", "status", "createdAt");
CREATE INDEX "ResumeAuditRun_resumeRevisionVersionId_createdAt_idx" ON "ResumeAuditRun"("resumeRevisionVersionId", "createdAt");

-- Foreign keys
ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_baseResumeCompositionVersionId_fkey"
FOREIGN KEY ("baseResumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_predecessorRevisionId_fkey"
FOREIGN KEY ("predecessorRevisionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_structuredResumeVersionId_fkey"
FOREIGN KEY ("structuredResumeVersionId") REFERENCES "StructuredResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRevisionVersion"
ADD CONSTRAINT "ResumeRevisionVersion_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_resumeRevisionVersionId_fkey"
FOREIGN KEY ("resumeRevisionVersionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
