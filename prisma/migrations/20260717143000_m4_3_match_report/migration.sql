CREATE TYPE "MatchReportRunStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TABLE "MatchReportRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "evidenceScoringRunId" TEXT NOT NULL,
  "evidenceRetrievalRunId" TEXT NOT NULL,
  "careerProfileVersionId" TEXT NOT NULL,
  "requirementAnalysisId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "applicationId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "configurationVersion" TEXT NOT NULL,
  "scoringInputChecksum" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "status" "MatchReportRunStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "summary" JSONB,
  "diagnostics" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "MatchReportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchReportRun_workspaceId_createdAt_idx"
  ON "MatchReportRun"("workspaceId", "createdAt");

CREATE INDEX "MatchReportRun_evidenceScoringRunId_createdAt_idx"
  ON "MatchReportRun"("evidenceScoringRunId", "createdAt");

CREATE INDEX "MatchReportRun_evidenceRetrievalRunId_createdAt_idx"
  ON "MatchReportRun"("evidenceRetrievalRunId", "createdAt");

CREATE INDEX "MatchReportRun_careerProfileVersionId_createdAt_idx"
  ON "MatchReportRun"("careerProfileVersionId", "createdAt");

CREATE INDEX "MatchReportRun_requirementAnalysisId_createdAt_idx"
  ON "MatchReportRun"("requirementAnalysisId", "createdAt");

CREATE INDEX "MatchReportRun_jobDescriptionVersionId_createdAt_idx"
  ON "MatchReportRun"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "MatchReportRun_applicationId_createdAt_idx"
  ON "MatchReportRun"("applicationId", "createdAt");

CREATE INDEX "MatchReportRun_workspaceId_inputChecksum_status_createdAt_idx"
  ON "MatchReportRun"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_evidenceScoringRunId_fkey"
FOREIGN KEY ("evidenceScoringRunId") REFERENCES "EvidenceScoringRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_evidenceRetrievalRunId_fkey"
FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_careerProfileVersionId_fkey"
FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_requirementAnalysisId_fkey"
FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportRun"
ADD CONSTRAINT "MatchReportRun_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
