CREATE TYPE "JobRequirementAnalysisStatus" AS ENUM (
  'DRAFT',
  'NEEDS_REVIEW',
  'CONFIRMED',
  'SUPERSEDED',
  'FAILED'
);

CREATE TABLE "JobRequirementAnalysis" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "jobDescriptionParseId" TEXT NOT NULL,
  "predecessorId" TEXT,
  "contractVersion" TEXT NOT NULL,
  "classifierVersion" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "status" "JobRequirementAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "analysis" JSONB NOT NULL,
  "diagnostics" JSONB NOT NULL,
  "createdByWorkflow" TEXT NOT NULL,
  "acknowledgement" JSONB,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),

  CONSTRAINT "JobRequirementAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRequirementAnalysis_workspaceId_createdAt_idx"
  ON "JobRequirementAnalysis"("workspaceId", "createdAt");

CREATE INDEX "JobRequirementAnalysis_jobDescriptionVersionId_createdAt_idx"
  ON "JobRequirementAnalysis"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "JobRequirementAnalysis_jobDescriptionParseId_classifierVers_idx"
  ON "JobRequirementAnalysis"("jobDescriptionParseId", "classifierVersion", "status", "createdAt");

ALTER TABLE "JobRequirementAnalysis"
ADD CONSTRAINT "JobRequirementAnalysis_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobRequirementAnalysis"
ADD CONSTRAINT "JobRequirementAnalysis_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId")
REFERENCES "JobDescriptionVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobRequirementAnalysis"
ADD CONSTRAINT "JobRequirementAnalysis_jobDescriptionParseId_fkey"
FOREIGN KEY ("jobDescriptionParseId")
REFERENCES "JobDescriptionParse"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobRequirementAnalysis"
ADD CONSTRAINT "JobRequirementAnalysis_predecessorId_fkey"
FOREIGN KEY ("predecessorId")
REFERENCES "JobRequirementAnalysis"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
