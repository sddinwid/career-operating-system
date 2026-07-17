import { ApplicationStatus, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";

const prisma = new PrismaClient();

const E2E_COMPANY_NAME = "E2E Grid Company";
const E2E_ROLE_NAME = "E2E Grid Role";
const E2E_APPLIED_AT_LOCAL = "2026-07-15T10:00";

async function main() {
  const workspace = await prisma.workspace.findFirstOrThrow({
    where: {
      id: "local-workspace"
    }
  });

  await prisma.userSetting.deleteMany({
    where: {
      workspaceId: workspace.id,
      key: "applicationsGridPreferences"
    }
  });

  const existingApplications = await prisma.application.findMany({
    where: {
      workspaceId: workspace.id,
      opportunity: {
        title: E2E_ROLE_NAME,
        company: {
          name: E2E_COMPANY_NAME
        }
      }
    },
    select: {
      id: true,
      opportunityId: true,
      opportunity: {
        select: {
          companyId: true
        }
      }
    }
  });

  if (existingApplications.length > 0) {
    const applicationIds = existingApplications.map((application) => application.id);
    const opportunityIds = Array.from(
      new Set(existingApplications.map((application) => application.opportunityId))
    );
    const companyIds = Array.from(
      new Set(existingApplications.map((application) => application.opportunity.companyId))
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.activity.deleteMany({
        where: {
          applicationId: {
            in: applicationIds
          }
        }
      });
      await transaction.resumeAuditRun.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.resumeCompositionVersion.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.structuredResumeVersion.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.matchReportRun.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.evidenceScoringRun.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.evidenceRetrievalRun.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.jobRequirementAnalysis.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              jobDescriptionParse: {
                jobDescriptionVersion: {
                  sourceApplicationId: {
                    in: applicationIds
                  }
                }
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.jobDescriptionParse.deleteMany({
        where: {
          OR: [
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                sourceApplicationId: {
                  in: applicationIds
                }
              }
            },
            {
              workspaceId: workspace.id,
              jobDescriptionVersion: {
                opportunityId: {
                  in: opportunityIds
                }
              }
            }
          ]
        }
      });
      await transaction.jobDescriptionVersion.deleteMany({
        where: {
          OR: [
            {
              sourceApplicationId: {
                in: applicationIds
              }
            },
            {
              opportunityId: {
                in: opportunityIds
              }
            }
          ]
        }
      });
      await transaction.applicationStatusHistory.deleteMany({
        where: {
          applicationId: {
            in: applicationIds
          }
        }
      });
      await transaction.application.deleteMany({
        where: {
          id: {
            in: applicationIds
          }
        }
      });
      await transaction.jobOpportunity.deleteMany({
        where: {
          id: {
            in: opportunityIds
          }
        }
      });
      await transaction.company.deleteMany({
        where: {
          id: {
            in: companyIds
          }
        }
      });
    });
  }

  await createApplication(workspace.id, {
    companyName: E2E_COMPANY_NAME,
    role: E2E_ROLE_NAME,
    appliedAtLocal: E2E_APPLIED_AT_LOCAL,
    status: ApplicationStatus.APPLIED
  });

  await importCareerKnowledge({
    filePath: "fixtures/career_knowledge_base_fixture_v1.json",
    prismaClient: prisma,
    workspaceId: workspace.id
  });
}

main()
  .catch((error) => {
    console.error("prepare-e2e failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
