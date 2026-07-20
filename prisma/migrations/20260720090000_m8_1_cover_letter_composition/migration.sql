CREATE TYPE "CoverLetterCompositionVersionStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TABLE "CoverLetterCompositionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
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
  "predecessorId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "matchReportInputChecksum" TEXT NOT NULL,
  "careerSourceChecksum" TEXT NOT NULL,
  "resumeSourceInputChecksum" TEXT,
  "inputChecksum" TEXT NOT NULL,
  "status" "CoverLetterCompositionVersionStatus" NOT NULL DEFAULT 'PENDING',
  "content" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CoverLetterCompositionVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_resume_source_xor"
CHECK (
  ("resumeCompositionVersionId" IS NULL) <> ("resumeRevisionVersionId" IS NULL)
  OR ("resumeCompositionVersionId" IS NULL AND "resumeRevisionVersionId" IS NULL)
);

CREATE INDEX "CoverLetterCompositionVersion_workspaceId_createdAt_idx"
ON "CoverLetterCompositionVersion"("workspaceId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_applicationId_createdAt_idx"
ON "CoverLetterCompositionVersion"("applicationId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_jobOpportunityId_createdAt_idx"
ON "CoverLetterCompositionVersion"("jobOpportunityId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_jobDescriptionVersionId_createdAt_idx"
ON "CoverLetterCompositionVersion"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_careerProfileVersionId_createdAt_idx"
ON "CoverLetterCompositionVersion"("careerProfileVersionId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_requirementAnalysisId_createdAt_idx"
ON "CoverLetterCompositionVersion"("requirementAnalysisId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_evidenceRetrievalRunId_createdAt_idx"
ON "CoverLetterCompositionVersion"("evidenceRetrievalRunId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_evidenceScoringRunId_createdAt_idx"
ON "CoverLetterCompositionVersion"("evidenceScoringRunId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_matchReportRunId_createdAt_idx"
ON "CoverLetterCompositionVersion"("matchReportRunId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_resumeCompositionVersionId_createdAt_idx"
ON "CoverLetterCompositionVersion"("resumeCompositionVersionId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_resumeRevisionVersionId_createdAt_idx"
ON "CoverLetterCompositionVersion"("resumeRevisionVersionId", "createdAt");
CREATE INDEX "CoverLetterCompositionVersion_workspaceId_inputChecksum_status_createdAt_idx"
ON "CoverLetterCompositionVersion"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_jobOpportunityId_fkey"
FOREIGN KEY ("jobOpportunityId") REFERENCES "JobOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_evidenceRetrievalRunId_fkey"
FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_evidenceScoringRunId_fkey"
FOREIGN KEY ("evidenceScoringRunId") REFERENCES "EvidenceScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_matchReportRunId_fkey"
FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_resumeCompositionVersionId_fkey"
FOREIGN KEY ("resumeCompositionVersionId") REFERENCES "ResumeCompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_resumeRevisionVersionId_fkey"
FOREIGN KEY ("resumeRevisionVersionId") REFERENCES "ResumeRevisionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoverLetterCompositionVersion"
ADD CONSTRAINT "CoverLetterCompositionVersion_predecessorId_fkey"
FOREIGN KEY ("predecessorId") REFERENCES "CoverLetterCompositionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
