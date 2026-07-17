CREATE TYPE "JobDescriptionParseStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'FAILED'
);

CREATE TABLE "JobDescriptionParse" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "status" "JobDescriptionParseStatus" NOT NULL DEFAULT 'PENDING',
  "diagnostics" JSONB NOT NULL,
  "result" JSONB,
  "createdByWorkflow" TEXT NOT NULL,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "JobDescriptionParse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobDescriptionParse_workspaceId_createdAt_idx"
  ON "JobDescriptionParse"("workspaceId", "createdAt");

CREATE INDEX "JobDescriptionParse_jobDescriptionVersionId_createdAt_idx"
  ON "JobDescriptionParse"("jobDescriptionVersionId", "createdAt");

CREATE INDEX "JobDescriptionParse_jobDescriptionVersionId_parserVersion_sta_idx"
  ON "JobDescriptionParse"("jobDescriptionVersionId", "parserVersion", "status", "createdAt");

ALTER TABLE "JobDescriptionParse"
ADD CONSTRAINT "JobDescriptionParse_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionParse"
ADD CONSTRAINT "JobDescriptionParse_jobDescriptionVersionId_fkey"
FOREIGN KEY ("jobDescriptionVersionId")
REFERENCES "JobDescriptionVersion"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
