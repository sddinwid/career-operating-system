CREATE TYPE "CoverLetterRevisionVersionStatus" AS ENUM (
  'DRAFT',
  'FINALIZED',
  'SUPERSEDED',
  'FAILED'
);

CREATE TYPE "CoverLetterAuditRunStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TYPE "CoverLetterApprovalStatus" AS ENUM (
  'APPROVED',
  'REVOKED',
  'SUPERSEDED'
);

CREATE TYPE "CoverLetterSourceType" AS ENUM (
  'BASE_COMPOSITION',
  'FINALIZED_REVISION'
);

CREATE TABLE "CoverLetterRevisionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "coverLetterCompositionVersionId" TEXT NOT NULL,
  "predecessorRevisionId" TEXT,
  "applicationId" TEXT,
  "jobOpportunityId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "evidenceRetrievalRunId" TEXT NOT NULL,
  "evidenceScoringRunId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "resumeCompositionVersionId" TEXT,
  "resumeRevisionVersionId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "CoverLetterRevisionVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "content" JSONB,
  "changeSet" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "userNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "CoverLetterRevisionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoverLetterAuditRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType" "CoverLetterSourceType" NOT NULL,
  "coverLetterRevisionVersionId" TEXT,
  "coverLetterCompositionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "jobOpportunityId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "evidenceRetrievalRunId" TEXT NOT NULL,
  "evidenceScoringRunId" TEXT NOT NULL,
  "matchReportRunId" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "CoverLetterAuditRunStatus" NOT NULL DEFAULT 'PENDING',
  "renderingReadiness" TEXT NOT NULL,
  "result" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CoverLetterAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoverLetterApproval" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType" "CoverLetterSourceType" NOT NULL,
  "coverLetterCompositionVersionId" TEXT NOT NULL,
  "coverLetterRevisionVersionId" TEXT,
  "coverLetterAuditRunId" TEXT NOT NULL,
  "applicationId" TEXT,
  "jobOpportunityId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "predecessorApprovalId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "auditInputChecksum" TEXT NOT NULL,
  "status" "CoverLetterApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "renderingReadiness" TEXT NOT NULL,
  "warningAcknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "warningCount" INTEGER NOT NULL,
  "blockingCount" INTEGER NOT NULL,
  "approvalNote" TEXT,
  "warningAcknowledgement" TEXT,
  "revocationReason" TEXT,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoverLetterApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoverLetterRevisionVersion_workspace_created_idx"
ON "CoverLetterRevisionVersion"("workspaceId", "createdAt");

CREATE INDEX "CoverLetterRevisionVersion_composition_created_idx"
ON "CoverLetterRevisionVersion"("coverLetterCompositionVersionId", "createdAt");

CREATE INDEX "CoverLetterRevisionVersion_predecessor_created_idx"
ON "CoverLetterRevisionVersion"("predecessorRevisionId", "createdAt");

CREATE INDEX "CoverLetterRevisionVersion_jobdesc_created_idx"
ON "CoverLetterRevisionVersion"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "CoverLetterRevisionVersion_application_created_idx"
ON "CoverLetterRevisionVersion"("applicationId", "createdAt");

CREATE INDEX "CoverLetterRevisionVersion_ws_checksum_status_created_idx"
ON "CoverLetterRevisionVersion"("workspaceId", "inputChecksum", "status", "createdAt");

CREATE INDEX "CoverLetterAuditRun_workspace_created_idx"
ON "CoverLetterAuditRun"("workspaceId", "createdAt");

CREATE INDEX "CoverLetterAuditRun_revision_created_idx"
ON "CoverLetterAuditRun"("coverLetterRevisionVersionId", "createdAt");

CREATE INDEX "CoverLetterAuditRun_composition_created_idx"
ON "CoverLetterAuditRun"("coverLetterCompositionVersionId", "createdAt");

CREATE INDEX "CoverLetterAuditRun_jobdesc_created_idx"
ON "CoverLetterAuditRun"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "CoverLetterAuditRun_application_created_idx"
ON "CoverLetterAuditRun"("applicationId", "createdAt");

CREATE INDEX "CoverLetterAuditRun_ws_checksum_status_created_idx"
ON "CoverLetterAuditRun"("workspaceId", "inputChecksum", "status", "createdAt");

CREATE INDEX "CoverLetterApproval_workspace_created_idx"
ON "CoverLetterApproval"("workspaceId", "createdAt");

CREATE INDEX "CoverLetterApproval_jobdesc_created_idx"
ON "CoverLetterApproval"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "CoverLetterApproval_application_created_idx"
ON "CoverLetterApproval"("applicationId", "createdAt");

CREATE INDEX "CoverLetterApproval_audit_created_idx"
ON "CoverLetterApproval"("coverLetterAuditRunId", "createdAt");

CREATE INDEX "CoverLetterApproval_revision_created_idx"
ON "CoverLetterApproval"("coverLetterRevisionVersionId", "createdAt");

CREATE INDEX "CoverLetterApproval_ws_jobdesc_status_created_idx"
ON "CoverLetterApproval"("workspaceId", "jobDescriptionVersionId", "status", "createdAt");

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_coverLetterCompositionVersionId_fkey"
FOREIGN KEY ("coverLetterCompositionVersionId") REFERENCES "CoverLetterCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_predecessorRevisionId_fkey"
FOREIGN KEY ("predecessorRevisionId") REFERENCES "CoverLetterRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_jobOpportunityId_fkey"
FOREIGN KEY ("jobOpportunityId") REFERENCES "JobOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_evidenceRetrievalRunId_fkey"
FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_evidenceScoringRunId_fkey"
FOREIGN KEY ("evidenceScoringRunId") REFERENCES "EvidenceScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_resumeCompositionVersionId_fkey"
FOREIGN KEY ("resumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterRevisionVersion"
ADD CONSTRAINT "CoverLetterRevisionVersion_resumeRevisionVersionId_fkey"
FOREIGN KEY ("resumeRevisionVersionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_coverLetterRevisionVersionId_fkey"
FOREIGN KEY ("coverLetterRevisionVersionId") REFERENCES "CoverLetterRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_coverLetterCompositionVersionId_fkey"
FOREIGN KEY ("coverLetterCompositionVersionId") REFERENCES "CoverLetterCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_jobOpportunityId_fkey"
FOREIGN KEY ("jobOpportunityId") REFERENCES "JobOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_evidenceRetrievalRunId_fkey"
FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_evidenceScoringRunId_fkey"
FOREIGN KEY ("evidenceScoringRunId") REFERENCES "EvidenceScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterAuditRun"
ADD CONSTRAINT "CoverLetterAuditRun_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_workspace_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_coverLetterCompositionVersionId_fkey"
FOREIGN KEY ("coverLetterCompositionVersionId") REFERENCES "CoverLetterCompositionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_coverLetterRevisionVersionId_fkey"
FOREIGN KEY ("coverLetterRevisionVersionId") REFERENCES "CoverLetterRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_coverLetterAuditRunId_fkey"
FOREIGN KEY ("coverLetterAuditRunId") REFERENCES "CoverLetterAuditRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_jobOpportunityId_fkey"
FOREIGN KEY ("jobOpportunityId") REFERENCES "JobOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterApproval"
ADD CONSTRAINT "CoverLetterApproval_predecessorApprovalId_fkey"
FOREIGN KEY ("predecessorApprovalId") REFERENCES "CoverLetterApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
