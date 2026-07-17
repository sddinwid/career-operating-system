CREATE TYPE "EvidenceScoringRunStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TABLE "EvidenceScoringRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "evidenceRetrievalRunId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "retrievalInputChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "EvidenceScoringRunStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "EvidenceScoringRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceScoringRun_workspaceId_createdAt_idx"
  ON "EvidenceScoringRun"("workspaceId", "createdAt");

CREATE INDEX "EvidenceScoringRun_evidenceRetrievalRunId_createdAt_idx"
  ON "EvidenceScoringRun"("evidenceRetrievalRunId", "createdAt");

CREATE INDEX "EvidenceScoringRun_careerProfileVersionId_createdAt_idx"
  ON "EvidenceScoringRun"("careerProfileVersionId", "createdAt");

CREATE INDEX "EvidenceScoringRun_requirementAnalysisId_createdAt_idx"
  ON "EvidenceScoringRun"("requirementAnalysisId", "createdAt");

CREATE INDEX "EvidenceScoringRun_jobDescriptionVersionId_createdAt_idx"
  ON "EvidenceScoringRun"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "EvidenceScoringRun_applicationId_createdAt_idx"
  ON "EvidenceScoringRun"("applicationId", "createdAt");

CREATE INDEX "EvidenceScoringRun_workspaceId_inputChecksum_status_crea_idx"
  ON "EvidenceScoringRun"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_evidenceRetrievalRunId_fkey"
FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceScoringRun"
ADD CONSTRAINT "EvidenceScoringRun_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
