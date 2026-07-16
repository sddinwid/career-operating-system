import {
  ActivityType,
  ApplicationPriority,
  ApplicationStatus,
  JobOpportunityStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateApplicationWorkflowInput = {
  workspaceId: string;
  companyId: string;
  title: string;
  jobUrl?: string;
  source?: string;
  location?: string;
  appliedAt: Date;
  recordedAt?: Date;
  originalAppliedAt?: Date;
  jobSearchDate: Date;
  priority?: ApplicationPriority;
  notes?: string;
  activitySummary: string;
  activityNotes?: string;
};

export async function createApplicationWorkflow(
  input: CreateApplicationWorkflowInput
) {
  const recordedAt = input.recordedAt ?? input.appliedAt;

  return prisma.$transaction(async (transaction) => {
    const opportunity = await transaction.jobOpportunity.create({
      data: {
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        title: input.title,
        jobUrl: input.jobUrl,
        source: input.source,
        location: input.location,
        status: JobOpportunityStatus.APPLIED,
        capturedAt: recordedAt
      }
    });

    const application = await transaction.application.create({
      data: {
        workspaceId: input.workspaceId,
        opportunityId: opportunity.id,
        appliedAt: input.appliedAt,
        recordedAt,
        originalAppliedAt: input.originalAppliedAt,
        jobSearchDate: input.jobSearchDate,
        status: ApplicationStatus.APPLIED,
        priority: input.priority ?? ApplicationPriority.MEDIUM,
        notes: input.notes
      }
    });

    const statusHistory = await transaction.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: ApplicationStatus.DRAFT,
        toStatus: ApplicationStatus.APPLIED,
        occurredAt: input.appliedAt,
        recordedAt,
        source: "system.bootstrap",
        reason: "Initial application capture"
      }
    });

    const activity = await transaction.activity.create({
      data: {
        workspaceId: input.workspaceId,
        applicationId: application.id,
        companyId: input.companyId,
        type: ActivityType.SUBMITTED,
        occurredAt: input.appliedAt,
        recordedAt,
        jobSearchDate: input.jobSearchDate,
        timeZone: "America/Chicago",
        summary: input.activitySummary,
        notes: input.activityNotes
      }
    });

    return {
      opportunity,
      application,
      statusHistory,
      activity
    };
  });
}
