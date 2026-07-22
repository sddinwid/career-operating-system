-- CreateEnum
CREATE TYPE "CareerProfilePurpose" AS ENUM ('USER', 'FIXTURE');

-- AlterTable
ALTER TABLE "Workspace"
ADD COLUMN "currentCareerProfileVersionId" TEXT;

-- AlterTable
ALTER TABLE "CareerProfileSource"
ADD COLUMN "purpose" "CareerProfilePurpose" NOT NULL DEFAULT 'USER';

-- Backfill fixture classification for the known controlled fixture source.
UPDATE "CareerProfileSource"
SET "purpose" = 'FIXTURE'
WHERE "filename" = 'career_knowledge_base_fixture_v1.json'
   OR COALESCE("rawPayload"->'_meta'->>'owner', '') = 'Fixture Candidate';

-- Backfill the current workspace profile pointer from the latest active non-fixture version.
UPDATE "Workspace" AS w
SET "currentCareerProfileVersionId" = candidate."id"
FROM (
  SELECT DISTINCT ON (cpv."workspaceId")
    cpv."workspaceId",
    cpv."id"
  FROM "CareerProfileVersion" AS cpv
  INNER JOIN "CareerProfileSource" AS cps
    ON cps."id" = cpv."sourceId"
  WHERE cpv."active" = true
    AND cps."purpose" = 'USER'
  ORDER BY cpv."workspaceId", cpv."importedAt" DESC, cpv."id" DESC
) AS candidate
WHERE w."id" = candidate."workspaceId";

-- CreateIndex
CREATE INDEX "Workspace_currentCareerProfileVersionId_idx"
ON "Workspace"("currentCareerProfileVersionId");

-- AddForeignKey
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_currentCareerProfileVersionId_fkey"
FOREIGN KEY ("currentCareerProfileVersionId")
REFERENCES "CareerProfileVersion"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
