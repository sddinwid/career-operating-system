CREATE TYPE "EvidenceRetrievalRunStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TABLE "EvidenceRetrievalRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "careerSourceChecksum" TEXT NOT NULL,
  "requirementSourceChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "EvidenceRetrievalRunStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "EvidenceRetrievalRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceRetrievalRun_workspaceId_createdAt_idx"
  ON "EvidenceRetrievalRun"("workspaceId", "createdAt");

CREATE INDEX "EvidenceRetrievalRun_careerProfileVersionId_createdAt_idx"
  ON "EvidenceRetrievalRun"("careerProfileVersionId", "createdAt");

CREATE INDEX "EvidenceRetrievalRun_requirementAnalysisId_createdAt_idx"
  ON "EvidenceRetrievalRun"("requirementAnalysisId", "createdAt");

CREATE INDEX "EvidenceRetrievalRun_jobDescriptionVersionId_createdAt_idx"
  ON "EvidenceRetrievalRun"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "EvidenceRetrievalRun_applicationId_createdAt_idx"
  ON "EvidenceRetrievalRun"("applicationId", "createdAt");

CREATE INDEX "EvidenceRetrievalRun_workspaceId_inputChecksum_status_crea_idx"
  ON "EvidenceRetrievalRun"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "EvidenceRetrievalRun"
ADD CONSTRAINT "EvidenceRetrievalRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "EvidenceRetrievalRun"
ADD CONSTRAINT "EvidenceRetrievalRun_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId")
REFERENCES "CareerProfileVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "EvidenceRetrievalRun"
ADD CONSTRAINT "EvidenceRetrievalRun_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId")
REFERENCES "JobRequirementAnalysis"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "EvidenceRetrievalRun"
ADD CONSTRAINT "EvidenceRetrievalRun_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId")
REFERENCES "JobDescriptionVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "EvidenceRetrievalRun"
ADD CONSTRAINT "EvidenceRetrievalRun_applicationId_fkey"
FOREIGN KEY ("applicationId")
REFERENCES "Application"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
