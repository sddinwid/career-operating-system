-- CreateEnum
CREATE TYPE "ResumeCompositionVersionStatus" AS ENUM (
  'PENDING',
  'READY',
  'READY_WITH_WARNINGS',
  'NEEDS_REVIEW',
  'FAILED',
  'SUPERSEDED'
);

-- CreateTable
CREATE TABLE "ResumeCompositionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "structuredResumeVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "predecessorVersionId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "structuredResumeInputChecksum" TEXT NOT NULL,
  "careerSourceChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "ResumeCompositionVersionStatus" NOT NULL DEFAULT 'PENDING',
  "content" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ResumeCompositionVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResumeCompositionVersion_workspaceId_createdAt_idx" ON "ResumeCompositionVersion"("workspaceId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_structuredResumeVersionId_createdAt_idx" ON "ResumeCompositionVersion"("structuredResumeVersionId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_careerProfileVersionId_createdAt_idx" ON "ResumeCompositionVersion"("careerProfileVersionId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_requirementAnalysisId_createdAt_idx" ON "ResumeCompositionVersion"("requirementAnalysisId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_matchReportRunId_createdAt_idx" ON "ResumeCompositionVersion"("matchReportRunId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_jobDescriptionVersionId_createdAt_idx" ON "ResumeCompositionVersion"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_applicationId_createdAt_idx" ON "ResumeCompositionVersion"("applicationId", "createdAt");
CREATE INDEX "ResumeCompositionVersion_workspaceId_inputChecksum_status_createdAt_idx" ON "ResumeCompositionVersion"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_structuredResumeVersionId_fkey"
FOREIGN KEY ("structuredResumeVersionId") REFERENCES "StructuredResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeCompositionVersion"
ADD CONSTRAINT "ResumeCompositionVersion_predecessorVersionId_fkey"
FOREIGN KEY ("predecessorVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
