import { promises as fs } from "node:fs";
import path from "node:path";
import { ApplicationStatus, type PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { env } from "@/lib/env";

export const E2E_COMPANY_NAME = "E2E Grid Company";
export const E2E_ROLE_NAME = "E2E Grid Role";
export const E2E_APPLIED_AT_LOCAL = "2026-07-15T10:00";

export async function resetE2EApplicationFixture(
  prisma: PrismaClient,
  workspaceId = "local-workspace"
) {
  await prisma.userSetting.deleteMany({
    where: {
      workspaceId,
      key: "applicationsGridPreferences"
    }
  });

  const opportunities = await prisma.jobOpportunity.findMany({
    where: {
      workspaceId,
      title: E2E_ROLE_NAME,
      company: {
        name: E2E_COMPANY_NAME
      }
    },
    select: {
      id: true,
      companyId: true
    }
  });

  const opportunityIds = opportunities.map((opportunity) => opportunity.id);
  const companyIds = Array.from(new Set(opportunities.map((opportunity) => opportunity.companyId)));

  const applications = await prisma.application.findMany({
    where: {
      workspaceId,
      opportunityId: {
        in: opportunityIds
      }
    },
    select: {
      id: true
    }
  });
  const applicationIds = applications.map((application) => application.id);

  const jobDescriptionVersionIds = (
    await prisma.jobDescriptionVersion.findMany({
      where: {
        workspaceId,
        opportunityId: {
          in: opportunityIds
        }
      },
      select: {
        id: true
      }
    })
  ).map((version) => version.id);

  const documentIds = (
    await prisma.document.findMany({
      where: {
        workspaceId,
        OR: [
          {
            applicationId: {
              in: applicationIds
            }
          },
          {
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      },
      select: {
        id: true
      }
    })
  ).map((document) => document.id);

  await prisma.$transaction(async (transaction) => {
    if (applicationIds.length > 0) {
      await transaction.activity.deleteMany({
        where: {
          applicationId: {
            in: applicationIds
          }
        }
      });
    }

    await transaction.documentVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.document.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.resumeRenderingApproval.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.resumeAuditRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.coverLetterApproval.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.coverLetterAuditRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.coverLetterRevisionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.resumeRevisionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
            jobDescriptionVersion: {
              opportunityId: {
                in: opportunityIds
              }
            }
          }
        ]
      }
    });
    await transaction.coverLetterCompositionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId,
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
            workspaceId,
            jobDescriptionParse: {
              jobDescriptionVersion: {
                sourceApplicationId: {
                  in: applicationIds
                }
              }
            }
          },
          {
            workspaceId,
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
            workspaceId,
            jobDescriptionVersion: {
              sourceApplicationId: {
                in: applicationIds
              }
            }
          },
          {
            workspaceId,
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

    if (applicationIds.length > 0) {
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
    }

    if (opportunityIds.length > 0) {
      await transaction.jobOpportunity.deleteMany({
        where: {
          id: {
            in: opportunityIds
          }
        }
      });
    }

    if (companyIds.length > 0) {
      await transaction.company.deleteMany({
        where: {
          id: {
            in: companyIds
          }
        }
      });
    }
  });

  for (const documentId of documentIds) {
    await fs.rm(path.resolve(env.LOCAL_DATA_DIR, "artifacts", "documents", workspaceId, documentId), {
      recursive: true,
      force: true
    });
  }

  await createApplication(workspaceId, {
    companyName: E2E_COMPANY_NAME,
    role: E2E_ROLE_NAME,
    appliedAtLocal: E2E_APPLIED_AT_LOCAL,
    status: ApplicationStatus.APPLIED
  });
}
