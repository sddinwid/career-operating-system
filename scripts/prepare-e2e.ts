import { promises as fs } from "node:fs";
import path from "node:path";
import { ApplicationStatus, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import { env } from "@/lib/env";

const prisma = new PrismaClient();

const E2E_COMPANY_NAME = "E2E Grid Company";
const E2E_ROLE_NAME = "E2E Grid Role";
const E2E_APPLIED_AT_LOCAL = "2026-07-15T10:00";
const FIELDGUIDE_COMPANY_NAME = "Fieldguide";
const FIELDGUIDE_ROLE_NAME = "Software Engineer (All Levels)";
const FIELDGUIDE_SOURCE_URL = "https://www.fieldguide.io/careers/software-engineer-all-levels";

async function cleanupOpportunityFixtures(args: {
  workspaceId: string;
  companyName: string;
  roleName: string;
  sourceUrl?: string;
}) {
  const matchingVersions = await prisma.jobDescriptionVersion.findMany({
    where: {
      workspaceId: args.workspaceId,
      sourceUrl: args.sourceUrl,
      opportunity: {
        title: args.roleName,
        company: {
          name: args.companyName
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
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const jobDescriptionVersionIds = Array.from(new Set(matchingVersions.map((version) => version.id)));
  const opportunityIds = Array.from(
    new Set(matchingVersions.map((version) => version.opportunityId))
  );
  if (jobDescriptionVersionIds.length === 0 && opportunityIds.length === 0) {
    return;
  }

  const applicationIds = (
    await prisma.application.findMany({
      where: {
        workspaceId: args.workspaceId,
        opportunityId: {
          in: opportunityIds
        }
      },
      select: {
        id: true
      }
    })
  ).map((application) => application.id);
  const documentIds = (
    await prisma.document.findMany({
      where: {
        workspaceId: args.workspaceId,
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
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
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
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
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
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.resumeAuditRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.coverLetterApproval.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.coverLetterAuditRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.coverLetterRevisionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.resumeRevisionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.resumeCompositionVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.structuredResumeVersion.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.matchReportRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.evidenceScoringRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.evidenceRetrievalRun.deleteMany({
      where: {
        OR: [
          {
            workspaceId: args.workspaceId,
            applicationId: {
              in: applicationIds
            }
          },
          {
            workspaceId: args.workspaceId,
            jobDescriptionVersionId: {
              in: jobDescriptionVersionIds
            }
          }
        ]
      }
    });
    await transaction.jobRequirementAnalysis.deleteMany({
      where: {
        workspaceId: args.workspaceId,
        jobDescriptionVersionId: {
          in: jobDescriptionVersionIds
        }
      }
    });
    await transaction.jobDescriptionParse.deleteMany({
      where: {
        workspaceId: args.workspaceId,
        jobDescriptionVersionId: {
          in: jobDescriptionVersionIds
        }
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

    await transaction.jobDescriptionVersion.deleteMany({
      where: {
        id: {
          in: jobDescriptionVersionIds
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
  });

  for (const documentId of documentIds) {
    await fs.rm(
      path.resolve(env.LOCAL_DATA_DIR, "artifacts", "documents", args.workspaceId, documentId),
      {
        recursive: true,
        force: true
      }
    );
  }
}

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

  await cleanupOpportunityFixtures({
    workspaceId: workspace.id,
    companyName: FIELDGUIDE_COMPANY_NAME,
    roleName: FIELDGUIDE_ROLE_NAME,
    sourceUrl: FIELDGUIDE_SOURCE_URL
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
    const jobDescriptionVersionIds = (
      await prisma.jobDescriptionVersion.findMany({
        where: {
          workspaceId: workspace.id,
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
          workspaceId: workspace.id,
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
      await transaction.activity.deleteMany({
        where: {
          applicationId: {
            in: applicationIds
          }
        }
      });
      await transaction.documentVersion.deleteMany({
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
              workspaceId: workspace.id,
              applicationId: {
                in: applicationIds
              }
            },
            {
              workspaceId: workspace.id,
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
      await transaction.coverLetterApproval.deleteMany({
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
      await transaction.coverLetterAuditRun.deleteMany({
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
      await transaction.coverLetterRevisionVersion.deleteMany({
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
      await transaction.resumeRevisionVersion.deleteMany({
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
      await transaction.coverLetterCompositionVersion.deleteMany({
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

    for (const documentId of documentIds) {
      await fs.rm(
        path.resolve(env.LOCAL_DATA_DIR, "artifacts", "documents", workspace.id, documentId),
        {
          recursive: true,
          force: true
        }
      );
    }
  }

  await createApplication(workspace.id, {
    companyName: E2E_COMPANY_NAME,
    role: E2E_ROLE_NAME,
    appliedAtLocal: E2E_APPLIED_AT_LOCAL,
    status: ApplicationStatus.APPLIED
  });

  const imported = await importCareerKnowledge({
    filePath: "fixtures/career_knowledge_base_fixture_v1.json",
    prismaClient: prisma,
    workspaceId: workspace.id
  });
  const fixtureVersionId = imported.versionId ?? imported.reusedVersionId;

  if (fixtureVersionId) {
    await prisma.$transaction(async (transaction) => {
      await transaction.careerProfileVersion.updateMany({
        where: {
          workspaceId: workspace.id,
          active: true,
          NOT: {
            id: fixtureVersionId
          }
        },
        data: {
          active: false,
          supersededAt: new Date()
        }
      });

      await transaction.careerProfileVersion.update({
        where: {
          id: fixtureVersionId
        },
        data: {
          active: true,
          supersededAt: null
        }
      });
    });
  }
}

main()
  .catch((error) => {
    console.error("prepare-e2e failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
