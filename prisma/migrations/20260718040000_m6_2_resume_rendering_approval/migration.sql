-- CreateEnum
CREATE TYPE "ResumeRenderingApprovalStatus" AS ENUM (
  'APPROVED',
  'REVOKED',
  'SUPERSEDED'
);

-- CreateEnum
CREATE TYPE "ResumeRenderingSourceType" AS ENUM (
  'BASE_COMPOSITION',
  'FINALIZED_REVISION'
);

-- CreateEnum
CREATE TYPE "ResumeRenderingArtifactType" AS ENUM (
  'RESUME'
);

-- CreateEnum
CREATE TYPE "ResumeRenderingApproverType" AS ENUM (
  'WORKSPACE_OWNER'
);

-- CreateTable
CREATE TABLE "ResumeRenderingApproval" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "resumeArtifactType" "ResumeRenderingArtifactType" NOT NULL DEFAULT 'RESUME',
  "sourceType" "ResumeRenderingSourceType" NOT NULL,
  "resumeCompositionVersionId" TEXT,
  "resumeRevisionVersionId" TEXT,
  "resumeAuditRunId" TEXT NOT NULL,
  "structuredResumeVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "predecessorApprovalId" TEXT,
  "approverType" "ResumeRenderingApproverType" NOT NULL DEFAULT 'WORKSPACE_OWNER',
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "auditInputChecksum" TEXT NOT NULL,
  "status" "ResumeRenderingApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "renderingReadiness" TEXT NOT NULL,
  "warningAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "warningCount" INTEGER NOT NULL,
  "blockingCount" INTEGER NOT NULL,
  "approvalNote" TEXT,
  "warningAcknowledgement" TEXT,
  "revocationReason" TEXT,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeRenderingApproval_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ResumeRenderingApproval_workspaceId_createdAt_idx" ON "ResumeRenderingApproval"("workspaceId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_workspace_jobdesc_created_idx" ON "ResumeRenderingApproval"("workspaceId", "jobDescriptionVersionId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_applicationId_createdAt_idx" ON "ResumeRenderingApproval"("applicationId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_resumeAuditRunId_createdAt_idx" ON "ResumeRenderingApproval"("resumeAuditRunId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_resumeCompositionVersionId_createdAt_idx" ON "ResumeRenderingApproval"("resumeCompositionVersionId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_resumeRevisionVersionId_createdAt_idx" ON "ResumeRenderingApproval"("resumeRevisionVersionId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_predecessorApprovalId_createdAt_idx" ON "ResumeRenderingApproval"("predecessorApprovalId", "createdAt");
CREATE INDEX "ResumeRenderingApproval_ws_job_artifact_status_idx" ON "ResumeRenderingApproval"("workspaceId", "jobDescriptionVersionId", "resumeArtifactType", "status", "createdAt");
CREATE INDEX "ResumeRenderingApproval_workspaceId_contentChecksum_resumeAuditRunId_status_createdAt_idx" ON "ResumeRenderingApproval"("workspaceId", "contentChecksum", "resumeAuditRunId", "status", "createdAt");

-- Foreign keys
ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_resumeCompositionVersionId_fkey"
FOREIGN KEY ("resumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_resumeRevisionVersionId_fkey"
FOREIGN KEY ("resumeRevisionVersionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_resumeAuditRunId_fkey"
FOREIGN KEY ("resumeAuditRunId") REFERENCES "ResumeAuditRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_structuredResumeVersionId_fkey"
FOREIGN KEY ("structuredResumeVersionId") REFERENCES "StructuredResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResumeRenderingApproval"
ADD CONSTRAINT "ResumeRenderingApproval_predecessorApprovalId_fkey"
FOREIGN KEY ("predecessorApprovalId") REFERENCES "ResumeRenderingApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
