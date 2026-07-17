-- CreateEnum
CREATE TYPE "ResumeAuditRunStatus" AS ENUM (
  'PENDING',
  'PASSED',
  'PASSED_WITH_WARNINGS',
  'FAILED',
  'NEEDS_REVIEW'
);

-- CreateTable
CREATE TABLE "ResumeAuditRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "resumeCompositionVersionId" TEXT NOT NULL,
  "structuredResumeVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "resumeCompositionInputChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "ResumeAuditRunStatus" NOT NULL DEFAULT 'PENDING',
  "renderingReadiness" TEXT NOT NULL,
  "result" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ResumeAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResumeAuditRun_workspaceId_createdAt_idx" ON "ResumeAuditRun"("workspaceId", "createdAt");
CREATE INDEX "ResumeAuditRun_resumeCompositionVersionId_createdAt_idx" ON "ResumeAuditRun"("resumeCompositionVersionId", "createdAt");
CREATE INDEX "ResumeAuditRun_structuredResumeVersionId_createdAt_idx" ON "ResumeAuditRun"("structuredResumeVersionId", "createdAt");
CREATE INDEX "ResumeAuditRun_careerProfileVersionId_createdAt_idx" ON "ResumeAuditRun"("careerProfileVersionId", "createdAt");
CREATE INDEX "ResumeAuditRun_matchReportRunId_createdAt_idx" ON "ResumeAuditRun"("matchReportRunId", "createdAt");
CREATE INDEX "ResumeAuditRun_requirementAnalysisId_createdAt_idx" ON "ResumeAuditRun"("requirementAnalysisId", "createdAt");
CREATE INDEX "ResumeAuditRun_jobDescriptionVersionId_createdAt_idx" ON "ResumeAuditRun"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "ResumeAuditRun_applicationId_createdAt_idx" ON "ResumeAuditRun"("applicationId", "createdAt");
CREATE INDEX "ResumeAuditRun_workspaceId_inputChecksum_status_createdAt_idx" ON "ResumeAuditRun"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_resumeCompositionVersionId_fkey"
FOREIGN KEY ("resumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_structuredResumeVersionId_fkey"
FOREIGN KEY ("structuredResumeVersionId") REFERENCES "StructuredResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeAuditRun"
ADD CONSTRAINT "ResumeAuditRun_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
