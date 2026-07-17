CREATE TYPE "JobDescriptionSourceType" AS ENUM (
  'MANUAL_PASTE',
  'LINKEDIN',
  'COMPANY_SITE',
  'RECRUITER',
  'EMAIL',
  'JOB_BOARD',
  'IMPORTED_FILE',
  'OTHER'
);

ALTER TABLE "Application"
ADD COLUMN "currentJobDescriptionVersionId" TEXT;

CREATE TABLE "JobDescriptionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "sourceApplicationId" TEXT,
  "predecessorId" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "originalText" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceType" "JobDescriptionSourceType" NOT NULL,
  "sourceTitle" TEXT,
  "sourceFilename" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" DATE,
  "checksum" TEXT NOT NULL,
  "formatVersion" TEXT NOT NULL,
  "createdByWorkflow" TEXT NOT NULL,
  "provenance" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JobDescriptionVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobDescriptionVersion_opportunityId_versionNumber_key"
  ON "JobDescriptionVersion"("opportunityId", "versionNumber");

CREATE UNIQUE INDEX "JobDescriptionVersion_opportunityId_checksum_key"
  ON "JobDescriptionVersion"("opportunityId", "checksum");

CREATE INDEX "Application_currentJobDescriptionVersionId_idx"
  ON "Application"("currentJobDescriptionVersionId");

CREATE INDEX "JobDescriptionVersion_workspaceId_opportunityId_active_createdAt_idx"
  ON "JobDescriptionVersion"("workspaceId", "opportunityId", "active", "createdAt");

CREATE INDEX "JobDescriptionVersion_sourceApplicationId_createdAt_idx"
  ON "JobDescriptionVersion"("sourceApplicationId", "createdAt");

ALTER TABLE "Application"
ADD CONSTRAINT "Application_currentJobDescriptionVersionId_fkey"
FOREIGN KEY ("currentJobDescriptionVersionId")
REFERENCES "JobDescriptionVersion"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionVersion"
ADD CONSTRAINT "JobDescriptionVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionVersion"
ADD CONSTRAINT "JobDescriptionVersion_opportunityId_fkey"
FOREIGN KEY ("opportunityId")
REFERENCES "JobOpportunity"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionVersion"
ADD CONSTRAINT "JobDescriptionVersion_sourceApplicationId_fkey"
FOREIGN KEY ("sourceApplicationId")
REFERENCES "Application"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "JobDescriptionVersion"
ADD CONSTRAINT "JobDescriptionVersion_predecessorId_fkey"
FOREIGN KEY ("predecessorId")
REFERENCES "JobDescriptionVersion"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
