import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { E2E_COMPANY_NAME, E2E_ROLE_NAME, resetE2EApplicationFixture } from "@/lib/testing/e2e-fixtures";

const prisma = new PrismaClient();
const FIELDGUIDE_COMPANY_NAME = "Fieldguide";
const FIELDGUIDE_ROLE_NAME = "Software Engineer (All Levels)";
const FIELDGUIDE_SOURCE_URL = "https://www.fieldguide.io/careers/software-engineer-all-levels";
type FieldguideStandaloneVersion = Awaited<ReturnType<typeof getFieldguideStandaloneVersion>>;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interactiveDocxArtifacts(page: Page) {
  return page.locator("a, button").filter({ hasText: /docx/i });
}

async function cleanupFieldguideStandaloneFixture() {
  const matchingVersions = await prisma.jobDescriptionVersion.findMany({
    where: {
      workspaceId: "local-workspace",
      sourceUrl: FIELDGUIDE_SOURCE_URL,
      opportunity: {
        title: FIELDGUIDE_ROLE_NAME,
        company: {
          name: FIELDGUIDE_COMPANY_NAME
        }
      }
    },
    select: {
      id: true,
      opportunityId: true
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const jobDescriptionVersionIds = Array.from(new Set(matchingVersions.map((version) => version.id)));
  const opportunityIds = Array.from(new Set(matchingVersions.map((version) => version.opportunityId)));

  if (jobDescriptionVersionIds.length === 0 && opportunityIds.length === 0) {
    return;
  }

  const applicationIds = (
    await prisma.application.findMany({
      where: {
        workspaceId: "local-workspace",
        opportunityId: {
          in: opportunityIds
        }
      },
      select: {
        id: true
      }
    })
  ).map((application) => application.id);

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

    const scopedDocumentWhere = {
      OR: [
        {
          workspaceId: "local-workspace",
          applicationId: {
            in: applicationIds
          }
        },
        {
          workspaceId: "local-workspace",
          jobDescriptionVersionId: {
            in: jobDescriptionVersionIds
          }
        }
      ]
    };

    await transaction.documentVersion.deleteMany({ where: scopedDocumentWhere });
    await transaction.document.deleteMany({ where: scopedDocumentWhere });
    await transaction.resumeRenderingApproval.deleteMany({ where: scopedDocumentWhere });
    await transaction.resumeAuditRun.deleteMany({ where: scopedDocumentWhere });
    await transaction.coverLetterCompositionVersion.deleteMany({ where: scopedDocumentWhere });
    await transaction.resumeRevisionVersion.deleteMany({ where: scopedDocumentWhere });
    await transaction.resumeCompositionVersion.deleteMany({ where: scopedDocumentWhere });
    await transaction.structuredResumeVersion.deleteMany({ where: scopedDocumentWhere });
    await transaction.matchReportRun.deleteMany({ where: scopedDocumentWhere });
    await transaction.evidenceScoringRun.deleteMany({ where: scopedDocumentWhere });
    await transaction.evidenceRetrievalRun.deleteMany({ where: scopedDocumentWhere });
    await transaction.jobRequirementAnalysis.deleteMany({
      where: {
        workspaceId: "local-workspace",
        jobDescriptionVersionId: {
          in: jobDescriptionVersionIds
        }
      }
    });
    await transaction.jobDescriptionParse.deleteMany({
      where: {
        workspaceId: "local-workspace",
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
}

async function getFieldguideStandaloneVersion() {
  return prisma.jobDescriptionVersion.findFirst({
    where: {
      workspaceId: "local-workspace",
      sourceUrl: FIELDGUIDE_SOURCE_URL,
      opportunity: {
        title: FIELDGUIDE_ROLE_NAME,
        company: {
          name: FIELDGUIDE_COMPANY_NAME
        }
      }
    },
    include: {
      parses: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          parserVersion: true,
          status: true
        }
      },
      requirementAnalyses: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          classifierVersion: true,
          status: true,
          jobDescriptionParseId: true
        }
      }
    }
  });
}

async function waitForFieldguideStandaloneVersion(
  predicate: (version: FieldguideStandaloneVersion | null) => boolean,
  failureMessage: string,
  timeoutMs = 5_000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const version = await getFieldguideStandaloneVersion();
    if (predicate(version)) {
      return version;
    }

    await delay(100);
  }

  throw new Error(failureMessage);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("parses and reviews the Fieldguide fixture as atomic, level-aware requirements before enabling evidence retrieval", async ({
  page
}) => {
  test.setTimeout(65_000);
  await cleanupFieldguideStandaloneFixture();
  const fieldguideDescription = await fs.readFile(
    path.join(process.cwd(), "fixtures", "fieldguide-software-engineer-all-levels.txt"),
    "utf8"
  );

  await page.goto("/jobs/new");
  await expect(page.getByRole("heading", { name: "Capture a new job description" })).toBeVisible();

  await page.getByRole("textbox", { name: "Company" }).fill("Fieldguide");
  await page.getByRole("textbox", { name: "Role" }).fill("Software Engineer (All Levels)");
  await page
    .getByRole("textbox", { name: "Job URL" })
    .fill("https://www.fieldguide.io/careers/software-engineer-all-levels");
  await page.getByRole("textbox", { name: "Opportunity source" }).fill("LinkedIn");
  await page
    .getByRole("textbox", { name: "Source URL" })
    .fill("https://www.fieldguide.io/careers/software-engineer-all-levels");
  await page
    .getByRole("textbox", { name: "Source title" })
    .fill("Fieldguide Software Engineer (All Levels)");
  await page.getByRole("textbox", { name: "Publication date" }).fill("2026-07-18");
  await page.getByRole("textbox", { name: "Job description text" }).fill(fieldguideDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(
    page.getByText("Job description saved successfully.")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Software Engineer (All Levels)" })).toBeVisible();
  const savedVersion = await waitForFieldguideStandaloneVersion(
    (version) => version !== null,
    "Expected the standalone Fieldguide job description version to be created."
  );
  expect(savedVersion?.parses).toHaveLength(0);
  expect(savedVersion?.requirementAnalyses).toHaveLength(0);

  await expect(page.getByRole("button", { name: "Parse Job Description" })).toBeVisible();
  await page.getByRole("button", { name: "Parse Job Description" }).click();

  await expect(page.getByText("Job description parsed successfully.")).toBeVisible();
  await expect(page.getByText("m3.2.5")).toBeVisible();
  const parsedVersion = await waitForFieldguideStandaloneVersion(
    (version) => version?.parses.length === 1,
    "Expected the standalone Fieldguide job description to have exactly one parse."
  );
  expect(parsedVersion?.parses).toHaveLength(1);
  expect(parsedVersion?.parses[0]?.parserVersion).toBe("m3.2.5");

  const parseId = parsedVersion?.parses[0]?.id;
  expect(parseId).toBeTruthy();

  await expect(page.getByRole("button", { name: "Reparse with Current Parser" })).toBeVisible();
  await page.getByRole("button", { name: "Reparse with Current Parser" }).click();
  await expect(
    page.getByText(
      "The current parser version already had a successful result, so the existing parse was reused."
    )
  ).toBeVisible();

  const reusedParseVersion = await waitForFieldguideStandaloneVersion(
    (version) => version?.parses.length === 1 && version.parses[0]?.id === parseId,
    "Expected the standalone Fieldguide job description to reuse the existing parse."
  );
  expect(reusedParseVersion?.parses).toHaveLength(1);
  expect(reusedParseVersion?.parses[0]?.id).toBe(parseId);

  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/analysis$/),
    page.getByRole("link", { name: "View Parsed Job Description" }).click()
  ]);

  await expect(page.getByText(/Core Competencies .* CORE COMPETENCIES/)).toBeVisible();
  await expect(page.getByText(/Technical Craft .* TECHNICAL CRAFT/)).toBeVisible();
  await expect(page.getByText(/Depth 1 .* Applicability ALL LEVELS/).first()).toBeVisible();
  await expect(page.getByText("Applicability: CONDITIONAL HIGHER LEVEL")).toBeVisible();
  await expect(page.getByText("TypeScript, React, Node.js, Python, and GraphQL")).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/requirements(?:\?|$)/),
    page.getByRole("link", { name: "Review Requirements" }).click()
  ]);
  await expect(page.getByText("Requirement review")).toBeVisible();

  const firstAnalysisVersion = await waitForFieldguideStandaloneVersion(
    (version) => version?.requirementAnalyses.length === 1,
    "Expected the standalone Fieldguide job description to have exactly one requirement analysis."
  );
  expect(firstAnalysisVersion?.requirementAnalyses).toHaveLength(1);
  expect(firstAnalysisVersion?.requirementAnalyses[0]?.classifierVersion).toBe("m3.3.3");
  expect(firstAnalysisVersion?.requirementAnalyses[0]?.jobDescriptionParseId).toBe(parseId);

  const analysisId = firstAnalysisVersion?.requirementAnalyses[0]?.id;
  expect(analysisId).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Requirement review")).toBeVisible();

  const reusedAnalysisVersion = await waitForFieldguideStandaloneVersion(
    (version) => version?.requirementAnalyses.length === 1 && version.requirementAnalyses[0]?.id === analysisId,
    "Expected the standalone Fieldguide job description to reuse the existing requirement analysis."
  );
  expect(reusedAnalysisVersion?.requirementAnalyses).toHaveLength(1);
  expect(reusedAnalysisVersion?.requirementAnalyses[0]?.id).toBe(analysisId);

  const requiredSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Required" }) });
  const preferredSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Preferred" }) });
  const contextualSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Contextual" }) });
  const responsibilitiesSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Responsibilities" }) });

  await expect(
    responsibilitiesSection.getByText(
      "Design, build, and deliver high-quality features that drive customer and business impact"
    )
  ).toBeVisible();
  await expect(
    responsibilitiesSection.getByText(
      "Collaborate cross-functionally with product and design to turn complex problems into elegant, user-focused solutions"
    )
  ).toBeVisible();
  await expect(
    responsibilitiesSection.getByText(
      "Balance iteration speed with long-term maintainability and system health"
    )
  ).toBeVisible();
  await expect(
    responsibilitiesSection.getByText(
      "Continuously improve our tech stack, developer workflows, and reliability practices"
    )
  ).toBeVisible();
  await expect(
    responsibilitiesSection.getByText(
      "Contribute to a supportive, growth-oriented engineering culture based on trust, learning, and excellence"
    )
  ).toBeVisible();

  await expect(
    requiredSection.getByText(
      "Strong software engineering fundamentals and experience shipping production code"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Familiarity with modern web technologies such as TypeScript, React, Node.js, Python, and GraphQL"
    )
  ).toBeVisible();
  await expect(requiredSection.getByText(/Technologies: .*TypeScript.*Node\.js.*React.*GraphQL/)).toBeVisible();
  await expect(
    requiredSection.getByText("Writing maintainable, well-tested, and observable code")
  ).toBeVisible();
  await expect(
    requiredSection.getByText("Sound judgment around tradeoffs, reliability, and performance")
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Ability to scope, prioritize, and deliver work that moves business outcomes"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Clear and proactive communication around progress, risks, and decisions"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Ownership mindset - following work through from ideation to production and iteration"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Empathy for teammates and customers; contributes positively to team culture"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText("Open to feedback and committed to continuous improvement")
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Works effectively across disciplines and functions to achieve shared goals"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Mentors and supports peers; contributes to hiring and onboarding processes"
    )
  ).toBeVisible();
  await expect(
    requiredSection.getByText(
      "Curious and self-driven in learning new skills, technologies, and domains"
    )
  ).toBeVisible();

  await expect(
    preferredSection.getByText(
      "Experience or familiarity with audit, assurance, or risk management domains"
    )
  ).toBeVisible();
  await expect(
    preferredSection.getByText(
      "Shaping a new tech stack, product, or engineering org from the ground up"
    )
  ).toBeVisible();
  await expect(
    preferredSection.getByText(
      "Working with infrastructure or data layers such as AWS, Postgres, and Hasura"
    )
  ).toBeVisible();
  await expect(preferredSection.getByText(/Technologies: .*AWS.*PostgreSQL.*Hasura/)).toBeVisible();
  await expect(
    preferredSection.getByText(
      "Architecting systems for document-heavy workflows, including ingestion, processing, and retrieval"
    )
  ).toBeVisible();
  await expect(
    preferredSection.getByText(
      "Integrating or building ML-powered systems for document understanding or search"
    )
  ).toBeVisible();
  await expect(preferredSection.getByText("Technologies: Machine Learning")).toBeVisible();
  await expect(
    preferredSection.getByText("Implementing DevOps and CI/CD best practices")
  ).toBeVisible();
  await expect(preferredSection.getByText("Technologies: CI/CD")).toBeVisible();
  await expect(
    preferredSection.getByText(
      "Applying information security and compliance principles (SOC 2, FedRAMP, etc.)"
    )
  ).toBeVisible();
  await expect(preferredSection.getByText("Technologies: SOC 2, FedRAMP")).toBeVisible();

  await expect(
    contextualSection.getByText("This role is open to remote candidates anywhere in the US")
  ).toBeVisible();
  await expect(
    contextualSection.getByText("Bay Area-based employees will work in a hybrid setting")
  ).toBeVisible();
  await expect(
    contextualSection.getByText(
      "The final level will be determined during the interview process based on scope and demonstrated experience"
    )
  ).toBeVisible();
  await expect(
    contextualSection.getByText(
      "Lead complex projects or systems, setting technical direction and ensuring long-term health"
    )
  ).toBeVisible();
  await expect(
    contextualSection.getByText(
      "Drive company-level technical initiatives and influence cross-team architecture"
    )
  ).toBeVisible();
  await expect(
    contextualSection.getByText(
      /Take increasing ownership - from building features to shaping architecture and mentoring others/
    )
  ).toBeVisible();
  await expect(contextualSection.getByText("Applicability: Conditional Higher Level")).toBeVisible();
  await expect(contextualSection.getByText("Applicability: Senior").first()).toBeVisible();
  await expect(contextualSection.getByText("Applicability: Staff").first()).toBeVisible();
  await expect(contextualSection.getByText("Section: Core Competencies > Culture & Growth").first()).toBeVisible();
  await expect(contextualSection.getByText("Fearless - Inspire and break down seemingly impossible walls")).toBeVisible();

  await expect(page.getByText(/0 errors, [0-9]+ warnings, [0-9]+ info/).first()).toBeVisible();
  await expect(page.getByText("READY", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Retrieve Career Evidence" })).toHaveCount(0);

  await page.getByRole("button", { name: "Confirm Requirement Analysis" }).click();
  await expect(page.getByText("Requirement analysis confirmed.")).toBeVisible();
  await expect(
    page.getByText(
      "This analysis is read-only. Create a revised analysis to make additional changes while preserving this confirmed version."
    )
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retrieve Career Evidence" })).toBeVisible();

  const confirmedAnalysisVersion = await getFieldguideStandaloneVersion();
  expect(confirmedAnalysisVersion?.requirementAnalyses).toHaveLength(1);
  expect(confirmedAnalysisVersion?.requirementAnalyses[0]?.id).toBe(analysisId);
  expect(confirmedAnalysisVersion?.requirementAnalyses[0]?.status).toBe("CONFIRMED");
});

test("captures, versions, and reuses job descriptions without changing application workflow state", async ({
  page
}) => {
  test.setTimeout(120_000);
  await resetE2EApplicationFixture(prisma);

  const companyName = E2E_COMPANY_NAME;
  const roleName = E2E_ROLE_NAME;
  const candidateName = "Fixture Candidate";
  const approvedRoleBullet = "Built backend services for internal tools.";
  const approvedAccomplishmentBullet = "Improved throughput by 20 percent.";
  const approvedProject = "Fixture Platform";
  const firstDescription = `${companyName}
${roleName}
Hybrid role based in Chicago, IL. Full-time position.

Responsibilities
- Build reliable internal TypeScript platforms on Node.js and AWS Lambda
- Improve observability and deployment safety
- Apply now to join our equal opportunity workplace

Required Qualifications
- 5+ years of TypeScript
- PostgreSQL and AWS experience required

Preferred Qualifications
- AWS certification preferred

Skills
- PostgreSQL and observability in production systems

Compensation
$150,000 - $180,000 base salary`;
  const secondDescription = `${firstDescription}

Preferred Qualifications
- Experience mentoring engineers`;

  await page.goto("/applications");
  await page.getByLabel("Applications view").selectOption("system:all-active");
  await page.getByRole("searchbox", { name: "Search applications" }).fill(companyName);

  const grid = page.getByTestId("applications-grid");
  await expect(
    grid.locator('.ag-cell[col-id="company"]').filter({ hasText: companyName })
  ).toHaveCount(1);

  await grid
    .locator(".ag-row")
    .filter({ hasText: companyName })
    .getByRole("button", { name: "Open" })
    .click();

  const statusCard = page
    .locator("article")
    .filter({ has: page.getByText("Status", { exact: true }) })
    .first();
  const initialStatusText = (await statusCard.textContent()) ?? "";
  const applicationId = preparedApplicationIdFromUrl(page.url());
  const initialStatusValue = initialStatusText.includes("INTERVIEW")
    ? "INTERVIEW"
    : "APPLIED";
  const nextStatusValue = initialStatusValue === "APPLIED" ? "INTERVIEW" : "APPLIED";
  const statusHistorySection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Status history" }) });
  const initialStatusHistoryCount = await statusHistorySection.locator("article").count();

  const replaceJobDescriptionLink = page.getByRole("link", { name: "Replace Job Description" });
  const addJobDescriptionLink = page.getByRole("link", { name: "Add Job Description" });
  const jobDescriptionEntryLink =
    (await replaceJobDescriptionLink.count()) > 0 ? replaceJobDescriptionLink : addJobDescriptionLink;

  await Promise.all([
    page.waitForURL(/\/applications\/[^/]+\/job-description$/, { timeout: 15_000 }),
    jobDescriptionEntryLink.click()
  ]);
  await expect(
    page.getByRole("heading", { name: /Add job description|Replace job description/ })
  ).toBeVisible();

  const descriptionField = page.getByRole("textbox", { name: "Job description text" });
  await descriptionField.fill(firstDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(
    page.getByText(
      /Job description saved successfully\.|That exact job description already existed for this opportunity, so the existing version was linked without creating a duplicate\./
    )
  ).toBeVisible();
  await expect(page.getByText("1 versions")).toBeVisible();
  await expect(page.getByRole("link", { name: "View version" })).toBeVisible();

  await page.getByRole("link", { name: "View version" }).click();
  await expect(
    page.getByRole("heading", { name: roleName })
  ).toBeVisible();
  await expect(page.getByText("Original text")).toBeVisible();
  await expect(page.getByText("Improve observability and deployment safety")).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("link", { name: "Replace Job Description" })).toBeVisible();

  await page.getByRole("link", { name: "Replace Job Description" }).click();
  await expect(
    page.getByRole("heading", { name: "Replace job description" })
  ).toBeVisible();
  await descriptionField.fill(secondDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(
    page.getByText(
      /Job description saved successfully\.|That exact job description already existed for this opportunity, so the existing version was linked without creating a duplicate\./
    )
  ).toBeVisible();
  await expect(page.getByText("2 versions")).toBeVisible();
  await expect(page.getByText("2").first()).toBeVisible();

  await page.getByRole("link", { name: "View version" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View predecessor (v1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Parse Job Description" })).toBeVisible();
  await page.getByRole("button", { name: "Parse Job Description" }).click();

  await expect(page.getByText("Job description parsed successfully.")).toBeVisible();
  await expect(page.getByText("SUCCESS", { exact: true })).toBeVisible();
  await expect(page.getByText("m3.2.5")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Parsed Job Description" })
  ).toBeVisible();

  await page.getByRole("link", { name: "View Parsed Job Description" }).click();
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible();
  await expect(page.getByText(companyName, { exact: true })).toBeVisible();
  await expect(page.getByText("Hybrid")).toBeVisible();
  await expect(page.getByText("$150,000 - $180,000 base salary")).toBeVisible();
  await expect(page.getByText("Experience mentoring engineers")).toBeVisible();
  await expect(page.getByText("TypeScript")).toBeVisible();
  await expect(page.getByText("5+ years with TypeScript")).toBeVisible();
  await expect(page.getByText(/\d+ errors, \d+ warnings, \d+ info/)).toBeVisible();

  await page.getByRole("link", { name: "Review Requirements" }).click();
  await expect(page.getByRole("heading", { name: "Needs Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contextual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Responsibilities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noise" })).toBeVisible();
  const contextualCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Required" }) })
    .locator("article")
    .filter({ hasText: "PostgreSQL and observability in production systems" })
    .first();
  await expect(contextualCard).toBeVisible();
  await contextualCard.getByLabel("Category").selectOption("REQUIRED");
  await contextualCard.getByLabel("Review note").fill("Treat this as a minimum requirement.");
  await contextualCard.getByLabel("Corrected display text").fill("Production PostgreSQL experience");
  await contextualCard.getByLabel("Requirement kinds").locator('input[value="DATA"]').check();
  await contextualCard.getByRole("button", { name: "Save requirement" }).click();

  await expect(page.getByText("Requirement review changes saved.")).toBeVisible();
  await expect(page.getByText("Production PostgreSQL experience").first()).toBeVisible();

  const noiseCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Noise" }) })
    .locator("article")
    .filter({ hasText: "Apply now to join our equal opportunity workplace" })
    .first();
  await noiseCard.getByRole("button", { name: "Exclude responsibility" }).click();
  await expect(page.getByText("Item excluded from downstream requirement use.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Excluded items" })).toBeVisible();

  const addRequirementSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add missing requirement" }) });
  await addRequirementSection
    .getByRole("textbox", { name: "Requirement text" })
    .fill("Experience coaching engineering teams");
  await addRequirementSection.getByRole("combobox", { name: "Category" }).selectOption("PREFERRED");
  await addRequirementSection
    .getByLabel("Requirement kinds")
    .locator('input[value="LEADERSHIP"]')
    .check();
  await addRequirementSection.getByRole("textbox", { name: "Review note" }).fill("Added during review.");
  await addRequirementSection.getByRole("button", { name: "Add user requirement" }).click();
  await expect(page.getByText("User-added requirement saved.")).toBeVisible();
  await expect(page.getByText("Experience coaching engineering teams").first()).toBeVisible();

  const lowConfidenceAcknowledgement = page.getByLabel(
    /I acknowledge the remaining low-confidence items/i
  );
  if ((await lowConfidenceAcknowledgement.count()) > 0) {
    await lowConfidenceAcknowledgement.check();
  }
  await page.getByRole("button", { name: "Confirm Requirement Analysis" }).click();
  await expect(page.getByText("Requirement analysis confirmed.")).toBeVisible();
  await expect(
    page.getByText(
      "This analysis is read-only. Create a revised analysis to make additional changes while preserving this confirmed version."
    )
  ).toBeVisible();
  await expect(page.getByText("User Added").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Retrieve Career Evidence" })).toBeVisible();
  await page.getByRole("button", { name: "Retrieve Career Evidence" }).click();
  await expect(page.getByText("Career evidence retrieval completed successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Candidate Evidence" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/evidence\?runId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Candidate Evidence" }).click()
  ]);
  await expect(page.getByRole("heading", { name: "Gap Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preferred" })).toBeVisible();
  await expect(page.getByText(/Retrieved because:/).first()).toBeVisible();
  await expect(page.getByText(/Restrictions:/).first()).toBeVisible();
  await expect(page.getByText(/NO CANDIDATES|LIMITED CANDIDATES/).first()).toBeVisible();
  await expect(page.getByText(/match percentage/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Score Retrieved Evidence" })).toBeVisible();
  await page.getByRole("button", { name: "Score Retrieved Evidence" }).click();
  await expect(page.getByText("Evidence scoring completed successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Evidence Scores" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/evidence\/scores\?runId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Evidence Scores" }).click()
  ]);
  await expect(page.getByRole("heading", { name: "Required" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preferred" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Restricted Only" })).toBeVisible();
  await expect(page.getByText(/Score \d+/).first()).toBeVisible();
  await expect(page.getByText("Positive Factors").first()).toBeVisible();
  await expect(page.getByText("Penalties").first()).toBeVisible();
  await expect(page.getByText(/PROFESSIONAL|PROJECT/).first()).toBeVisible();
  await expect(page.getByText(/CURRENT|RECENT|OLDER|UNKNOWN|STALE/).first()).toBeVisible();
  await expect(page.getByText(/Restrictions:/).first()).toBeVisible();
  await expect(page.getByText(/match percentage/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate Match Report" })).toBeVisible();
  await page.getByRole("button", { name: "Generate Match Report" }).click();
  await expect(page.getByText("Match report generated successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Match Report" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/match-report\?runId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Match Report" }).click()
  ]);
  await expect(page.getByText(/STRONG ALIGNMENT|GOOD ALIGNMENT|PARTIAL ALIGNMENT|WEAK ALIGNMENT|INSUFFICIENT EVIDENCE/).first()).toBeVisible();
  await expect(page.getByText(/PRIORITIZE|APPLY|CONSIDER|LOW PRIORITY|DO NOT RECOMMEND YET/).first()).toBeVisible();
  await expect(page.getByText(/READY|READY WITH LIMITATIONS|NEEDS REVIEW|NOT READY/).first()).toBeVisible();
  await expect(page.getByText(/Required total/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Strongest Alignment Areas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required Gaps" })).toBeVisible();
  await expect(page.getByText(/PROFESSIONAL|PROJECT/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resume Guidance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence Traceability" })).toBeVisible();
  await expect(page.getByText(/hiring probability/i)).toBeVisible();
  await expect(page.getByText(/match percentage/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate Cover Letter" })).toBeVisible();
  await page.getByRole("button", { name: "Generate Cover Letter" }).click();
  await expect(page.getByText("Cover letter composed successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Cover Letter" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\?versionId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Cover Letter" }).click()
  ]);
  await expect(page.getByText("Deterministic cover-letter preview")).toBeVisible();
  await expect(page.getByText("Dear Hiring Team,")).toBeVisible();
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible();
  await expect(page.getByText(companyName, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paragraph Provenance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.getByText(/\u2014/)).toHaveCount(0);
  const coverLetterVersionUrl = page.url();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Paragraph Provenance" }) })
      .locator("article")
  ).toHaveCount(5);
  const wordCountCard = page
    .locator("article")
    .filter({ has: page.getByText("Word count", { exact: true }) })
    .first();
  const wordCountText = await wordCountCard.textContent();
  const coverLetterWordCount = Number.parseInt(wordCountText?.replace(/\D+/g, "") ?? "0", 10);
  expect(coverLetterWordCount).toBeGreaterThanOrEqual(250);
  expect(coverLetterWordCount).toBeLessThanOrEqual(400);
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\/studio\?revisionId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "Create Cover Letter Revision" }).click()
  ]);
  await expect(page.getByText("Cover Letter Studio")).toBeVisible();
  const coverLetterDraftRevisionId = new URL(page.url()).searchParams.get("revisionId");
  expect(coverLetterDraftRevisionId).toBeTruthy();
  const initialCoverLetterDraft = await prisma.coverLetterRevisionVersion.findUnique({
    where: {
      id: coverLetterDraftRevisionId ?? ""
    },
    select: {
      updatedAt: true,
      content: true,
      userNotes: true
    }
  });
  expect(initialCoverLetterDraft?.updatedAt).toBeTruthy();
  const revisedOpeningParagraph =
    "I am excited to apply for this role because it lines up with the backend platform systems I have delivered in production.";
  const openingParagraphField = page.getByRole("textbox", { name: /opening paragraph/i });
  await expect(openingParagraphField).toBeVisible();
  await openingParagraphField.fill(revisedOpeningParagraph);
  await page
    .getByRole("textbox", { name: "Review Notes" })
    .fill("Tightened the opening and clarified why the role matches my production backend work.");
  const saveCoverLetterDraftResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      response.url().includes("/api/cover-letter-studio/") &&
      response.status() === 200
    );
  });
  await page.getByRole("button", { name: "Save Draft" }).click();
  await saveCoverLetterDraftResponse;
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("textbox", { name: /opening paragraph/i })).toHaveValue(
    revisedOpeningParagraph
  );
  const savedCoverLetterDraft = await prisma.coverLetterRevisionVersion.findUnique({
    where: {
      id: coverLetterDraftRevisionId ?? ""
    },
    select: {
      updatedAt: true,
      content: true,
      userNotes: true
    }
  });
  expect(savedCoverLetterDraft?.updatedAt).toBeTruthy();
  const staleCoverLetterSave = await page.evaluate(
    async ({ revisionId, updatedAt, content, userNotes }) => {
      const response = await fetch(`/api/cover-letter-studio/${revisionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAt,
          content,
          userNotes
        })
      });

      return {
        status: response.status,
        body: await response.json()
      };
    },
    {
      revisionId: coverLetterDraftRevisionId,
      updatedAt: initialCoverLetterDraft?.updatedAt.toISOString(),
      content: savedCoverLetterDraft?.content,
      userNotes: savedCoverLetterDraft?.userNotes
    }
  );
  expect(staleCoverLetterSave.status).toBe(409);
  expect(staleCoverLetterSave.body.code).toBe("STALE_REVISION");
  const invalidCoverLetterSave = await page.evaluate(
    async ({ revisionId, updatedAt, content, userNotes }) => {
      const invalidContent = structuredClone(content) as {
        salutation?: string;
      } | null;
      if (!invalidContent) {
        throw new Error("Expected finalized cover-letter content to be available.");
      }
      invalidContent.salutation = "";
      const response = await fetch(`/api/cover-letter-studio/${revisionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAt,
          content: invalidContent,
          userNotes
        })
      });

      return {
        status: response.status,
        body: await response.json()
      };
    },
    {
      revisionId: coverLetterDraftRevisionId,
      updatedAt: savedCoverLetterDraft?.updatedAt.toISOString(),
      content: savedCoverLetterDraft?.content,
      userNotes: savedCoverLetterDraft?.userNotes
    }
  );
  expect(invalidCoverLetterSave.status).toBe(400);
  await expect(page.getByRole("button", { name: "Finalize Revision" })).toBeVisible();
  const finalizedCoverLetterResponse = await page.evaluate(
    async ({ revisionId, updatedAt }) => {
      const returnTo = new URL(window.location.href).pathname;
      const response = await fetch(`/api/cover-letter-studio/${revisionId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAt,
          returnTo
        })
      });

      return {
        status: response.status,
        body: await response.json()
      };
    },
    {
      revisionId: coverLetterDraftRevisionId,
      updatedAt: savedCoverLetterDraft?.updatedAt.toISOString()
    }
  );
  expect(finalizedCoverLetterResponse.status).toBe(200);
  await page.goto(finalizedCoverLetterResponse.body.redirectTo, { waitUntil: "networkidle" });
  const coverLetterFinalizedRevisionId = new URL(page.url()).searchParams.get("revisionId");
  expect(coverLetterFinalizedRevisionId).toBeTruthy();
  await expect(page.getByText("Cover-letter revision finalized successfully.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /opening paragraph/i })).toBeDisabled();
  const repeatedFinalizeResponse = await page.evaluate(
    async ({ revisionId, updatedAt }) => {
      const response = await fetch(`/api/cover-letter-studio/${revisionId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAt,
          returnTo: "/job-descriptions/retry/cover-letter/studio"
        })
      });

      return {
        status: response.status,
        body: await response.json()
      };
    },
    {
      revisionId: coverLetterDraftRevisionId,
      updatedAt: savedCoverLetterDraft?.updatedAt.toISOString()
    }
  );
  expect(repeatedFinalizeResponse.status).toBe(200);
  expect(repeatedFinalizeResponse.body.revisionId).toBe(coverLetterFinalizedRevisionId);
  await Promise.all([
    page.waitForURL(
      /\/job-descriptions\/[^/]+\/cover-letter\/studio\?(?=.*\brevisionId=[^&]+)(?=.*\bsuccess=audit-(created|reused)\b).*/,
      {
        timeout: 15_000
      }
    ),
    page.getByRole("button", { name: "Run Audit" }).click()
  ]);
  await expect(page.getByText("Cover-letter audit completed successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Audit" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\/audit\?runId=[^&]+$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Audit" }).click()
  ]);
  await expect(page.getByText("Cover-letter audit report")).toBeVisible();
  await expect(page.getByText("Finalized Revision")).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\/compare\?revisionId=[^&]+$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Comparison" }).click()
  ]);
  await expect(page.getByText("Cover-letter comparison")).toBeVisible();
  await expect(page.getByText(/Modified - word delta/i)).toBeVisible();
  await expect(page.getByText(revisedOpeningParagraph)).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\/studio\?revisionId=[^&]+$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "Back to Revision" }).click()
  ]);
  await expect(page.getByText("Approval History")).toBeVisible();
  expect(await approveCoverLetter(page, { required: true })).toBe(true);
  const activeCoverLetterApprovalCount = await prisma.coverLetterApproval.count({
    where: {
      applicationId,
      status: "APPROVED"
    }
  });
  expect(activeCoverLetterApprovalCount).toBe(1);
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/cover-letter\/studio\?revisionId=[^&]+$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "Create Successor Draft" }).click()
  ]);
  await expect(page.getByText("Predecessor")).toBeVisible();
  const successorOpeningParagraph = page.getByRole("textbox", { name: /opening paragraph/i });
  const successorOpeningText =
    "I am excited to apply for this role because it matches the production platform systems I have led through delivery and iteration.";
  await successorOpeningParagraph.fill(successorOpeningText);
  const saveSuccessorDraftResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      response.url().includes("/api/cover-letter-studio/") &&
      response.status() === 200
    );
  });
  await page.getByRole("button", { name: "Save Draft" }).click();
  await saveSuccessorDraftResponse;
  const successorDraftRevisionId = new URL(page.url()).searchParams.get("revisionId");
  const savedSuccessorDraft = await prisma.coverLetterRevisionVersion.findUnique({
    where: {
      id: successorDraftRevisionId ?? ""
    },
    select: {
      updatedAt: true
    }
  });
  const finalizedSuccessorResponse = await page.evaluate(
    async ({ revisionId, updatedAt }) => {
      const returnTo = new URL(window.location.href).pathname;
      const response = await fetch(`/api/cover-letter-studio/${revisionId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          updatedAt,
          returnTo
        })
      });

      return {
        status: response.status,
        body: await response.json()
      };
    },
    {
      revisionId: successorDraftRevisionId,
      updatedAt: savedSuccessorDraft?.updatedAt.toISOString()
    }
  );
  expect(finalizedSuccessorResponse.status).toBe(200);
  await page.goto(finalizedSuccessorResponse.body.redirectTo, { waitUntil: "networkidle" });
  await Promise.all([
    page.waitForURL(
      /\/job-descriptions\/[^/]+\/cover-letter\/studio\?(?=.*\brevisionId=[^&]+)(?=.*\bsuccess=audit-(created|reused)\b).*/,
      {
        timeout: 15_000
      }
    ),
    page.getByRole("button", { name: "Run Audit" }).click()
  ]);
  expect(await approveCoverLetter(page, { required: true })).toBe(true);
  await expect(page.getByText("Approval History")).toBeVisible();
  await page.getByRole("textbox", { name: "Revocation reason" }).fill("Pausing the active cover-letter approval.");
  const revokeCoverLetterApprovalResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/cover-letter-approvals/") &&
      response.url().includes("/revoke"),
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: "Revoke Approval" }).click();
  await revokeCoverLetterApprovalResponse;
  await expect(page.getByText("The active cover-letter approval was revoked.")).toBeVisible();
  expect(await approveCoverLetter(page, { required: true })).toBe(true);
  const coverLetterStatusAfterWorkflow = await prisma.application.findUnique({
    where: {
      id: applicationId
    },
    select: {
      status: true
    }
  });
  expect(coverLetterStatusAfterWorkflow?.status).toBe(initialStatusValue);
  expect(
    await prisma.applicationStatusHistory.count({
      where: {
        applicationId
      }
    })
  ).toBe(initialStatusHistoryCount);
  expect(
    await prisma.documentVersion.count({
      where: {
        applicationId
      }
    })
  ).toBe(0);
  await page.getByRole("link", { name: "Return to Cover Letter" }).click();
  await page.getByRole("link", { name: "Open application" }).click();
  await expect(page.getByRole("button", { name: "Generate Cover Letter" })).toBeVisible();
  await page.getByRole("button", { name: "Generate Cover Letter" }).click();
  await expect(
    page.getByText(/existing composition was reused/i)
  ).toBeVisible();
  await page.goto(coverLetterVersionUrl, { waitUntil: "networkidle" });
  expect(page.url()).toContain(coverLetterVersionUrl.split("versionId=").at(-1)?.split("&")[0] ?? "");
  await page.getByRole("link", { name: "Back to Match Report" }).click();
  await expect(page.getByRole("button", { name: "Create Structured Resume Plan" })).toBeVisible();
  await page.getByRole("button", { name: "Create Structured Resume Plan" }).click();
  await expect(page.getByText("Structured resume plan created successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Structured Resume Plan" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/resume-plan\?versionId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "View Structured Resume Plan" }).click()
  ]);
  await expect(
    page.getByText(
      /GENERAL BACKEND|PYTHON BACKEND|NODE TYPESCRIPT BACKEND|MICROSOFT DOTNET|JAVA KOTLIN|AI AGENTIC|FULL STACK|TECHNICAL LEADERSHIP|OTHER/
    ).first()
  ).toBeVisible();
  await expect(page.getByText(/Section order:/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary Blueprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skills Plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bullet Evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claims to Avoid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page Budget" })).toBeVisible();
  await expect(page.getByText(/Structured resume plan/i).first()).toBeVisible();
  await expect(interactiveDocxArtifacts(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Compose Targeted Resume" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/resume\?versionId=.*success=composition-(created|reused)/, {
      timeout: 15_000
    }),
    page.getByRole("button", { name: "Compose Targeted Resume" }).click()
  ]);
  await expect(page.getByText("Targeted resume composed successfully.")).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("Targeted resume preview")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Run Resume Audit" })).toBeVisible();
  await expect(page.getByText(/\u2014/)).toHaveCount(0);
  await page.getByRole("button", { name: "Run Resume Audit" }).click();
  await expect(page.getByText("Resume audit completed successfully.")).toBeVisible();
  await expect(page.getByText(/READY FOR RENDERING|READY WITH WARNINGS|NEEDS REVIEW|BLOCKED/).first()).toBeVisible();
  const viewResumeAuditLink = page.getByRole("link", { name: "View Resume Audit" });
  await expect(viewResumeAuditLink).toHaveCount(1);
  await expect(viewResumeAuditLink).toBeVisible();
  await expect(viewResumeAuditLink).toHaveAttribute(
    "href",
    /\/job-descriptions\/[^/]+\/resume\/audit\?runId=[^&]+/
  );
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/resume\/audit\?runId=[^&]+(?:&success=[^&]+)?$/, {
      timeout: 15_000
    }),
    viewResumeAuditLink.click()
  ]);
  await expect(page.getByText("Resume audit report")).toBeVisible();
  await expect(page.getByText("Page budget")).toBeVisible();
  await expect(page.getByText("Statement Findings")).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume Composition" })).toBeVisible();
  await expect(interactiveDocxArtifacts(page)).toHaveCount(0);
  await approveForRendering(page, { required: true });
  await expect(page.getByRole("link", { name: "Open Resume Studio" })).toBeVisible();
  await Promise.all([
    page.waitForURL(
      /\/job-descriptions\/[^/]+\/resume\/studio\?revisionId=[^&]+(?:&.*)?$/,
      { timeout: 15_000 }
    ),
    page.getByRole("link", { name: "Open Resume Studio" }).click()
  ]);
  await expect(page.getByText("Resume Studio")).toBeVisible();

  const summarySection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Professional Summary" }) });
  const summaryTextarea = summarySection.getByRole("textbox", { name: "Revised" });
  await expect(summaryTextarea).toBeVisible({ timeout: 15_000 });
  await summaryTextarea.fill(
    "Platform engineer focused on TypeScript, PostgreSQL, and reliable backend platform delivery."
  );

  const skillsSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Skills" }) });
  const skillCheckboxes = skillsSection.locator('input[type="checkbox"]');
  const skillUps = skillsSection.locator('button:not([disabled])').filter({ hasText: "Up" });
  if ((await skillCheckboxes.count()) > 1) {
    await skillCheckboxes.nth(1).uncheck();
  }
  if ((await skillUps.count()) > 0) {
    await skillUps.first().click();
  }

  const experienceSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Professional Experience" }) });
  const roleBulletUps = experienceSection.locator('button:not([disabled])').filter({ hasText: "Up" });
  if ((await roleBulletUps.count()) > 0) {
    await roleBulletUps.first().click();
  }

  const projectSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Selected Projects" }) });

  await page
    .getByRole("textbox", { name: "Revision note" })
    .fill("Shortened the summary and trimmed optional content for a tighter employer-facing pass.");
  const saveDraftResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      response.url().includes("/api/resume-studio/") &&
      response.status() === 200
    );
  });
  await page.getByRole("button", { name: "Save Draft" }).click();
  await saveDraftResponse;
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review Notes" })).toBeVisible();
  await page.reload();
  await expect(summarySection.getByRole("textbox", { name: "Revised" })).toHaveValue(
    "Platform engineer focused on TypeScript, PostgreSQL, and reliable backend platform delivery."
  );
  await page.getByRole("button", { name: "Finalize for Audit" }).click();
  await expect(page.getByText("Revision actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Audit on Revised Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Run Audit on Revised Resume" }).click();
  await expect(page.getByText("Revision audit completed successfully.")).toBeVisible();
  await expect(page.getByText(/READY FOR RENDERING|READY WITH WARNINGS|NEEDS REVIEW|BLOCKED/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare with Base" })).toBeVisible();
  await page.getByRole("link", { name: "Compare with Base" }).click();
  await expect(page.getByText("Resume comparison")).toBeVisible();
  await expect(page.getByText("Resume Diff")).toBeVisible();
  await expect(page.getByText("Audit Comparison")).toBeVisible();
  await expect(page.getByText(/Provenance preserved|Provenance changed/i).first()).toBeVisible();
  await approveForRendering(page, { required: false });
  await expect(page.getByText("Approval History")).toBeVisible();
  await Promise.all([
    page.waitForURL(
      /\/job-descriptions\/[^/]+\/resume\/studio\?revisionId=[^&]+(?:&.*)?$/,
      { timeout: 15_000 }
    ),
    page.getByRole("link", { name: "Back to Revision" }).click()
  ]);
  await expect(page.getByRole("link", { name: "Create New Revision" }).first()).toBeVisible();
  await Promise.all([
    page.waitForURL(
      /\/job-descriptions\/[^/]+\/resume\/studio\?revisionId=[^&]+(?:&.*)?$/,
      { timeout: 15_000 }
    ),
    page.getByRole("link", { name: "Create New Revision" }).first().click()
  ]);
  await expect(page.getByText("Resume Studio")).toBeVisible();
  await expect(page.getByText("Predecessor revision")).toBeVisible();
  await expect(interactiveDocxArtifacts(page)).toHaveCount(0);
  await Promise.all([
    page.waitForURL(/\/job-descriptions\/[^/]+\/resume\?versionId=[^&]+(?:&.*)?$/, {
      timeout: 15_000
    }),
    page.getByRole("link", { name: "Back to Resume Preview" }).click()
  ]);
  await Promise.all([
    page.waitForURL(/\/applications\/[^/]+$/, { timeout: 15_000 }),
    page.getByRole("link", { name: "Open application" }).click()
  ]);
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Match report summary")).toBeVisible();
  await expect(page.getByText("Structured Resume Plan Generated")).toBeVisible();
  await expect(page.getByText("Resume Audit Complete")).toBeVisible();
  if ((await page.getByRole("button", { name: /Render Resume PDF/ }).count()) === 0) {
    await Promise.all([
      page.waitForURL(/\/job-descriptions\/[^/]+\/resume\/audit\?runId=[^&]+(?:&success=[^&]+)?$/, {
        timeout: 15_000
      }),
      page.getByRole("link", { name: "View Resume Audit" }).click()
    ]);
    await approveForRendering(page, { required: true });
    await page.getByRole("link", { name: "Open application" }).click();
  }
  await expect(page.getByText(/Resume PDF Rendering Ready|Immutable Resume PDF Ready/)).toBeVisible();
  await expect(page.getByText(/Active Approval|No Active Approval/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Comparison" })).toBeVisible();
  await expect(page.getByText(/Resume Generation Ready|Match Report Generated|Match Report Has Critical Gaps|Resume Generation Ready With Limitations/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Match Report" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Structured Resume Plan" })).toBeVisible();
  const renderResumePdfButton = page
    .locator("article")
    .filter({ hasText: "Resume PDF" })
    .getByRole("button", { name: "Render Resume PDF", exact: true });
  await expect(renderResumePdfButton).toHaveCount(1);
  const renderRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/applications/${applicationId}`) &&
      response.status() === 303
  );
  await renderResumePdfButton.click();
  const renderResponse = await renderRequest;
  expect(renderResponse.ok()).toBeFalsy();
  expect(renderResponse.status()).toBe(303);
  await expect(page.getByText("Approved resume rendered to an immutable PDF successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Resume PDF" })).toBeVisible();

  const renderedDocumentLink = page.getByRole("link", { name: "View Resume PDF" });
  const renderedDocumentHref = await renderedDocumentLink.getAttribute("href");
  expect(renderedDocumentHref).toMatch(/^\/documents\/[^/]+$/);
  expect(renderedDocumentHref?.split("/").pop()).toBeTruthy();

  await renderedDocumentLink.click();
  await expect(page.getByRole("heading", { name: `${companyName} ${roleName} Resume` })).toBeVisible();
  await expect(page.getByText(/Version 1/i).first()).toBeVisible();
  await expect(page.getByText(/Filename/i)).toBeVisible();
  await expect(page.getByText(/Format: PDF/i)).toBeVisible();
  await expect(page.getByText(/Renderer version: m7\.2\.0/i)).toBeVisible();
  await expect(page.getByText(/Template version: resume-pdf-v1/i)).toBeVisible();
  await expect(page.getByText(/Approval/i).first()).toBeVisible();
  await expect(page.getByText(/Audit/i).first()).toBeVisible();
  const sizeText = await page
    .locator("article")
    .filter({ has: page.getByText("Size", { exact: true }) })
    .first()
    .textContent();
  expect(Number.parseInt(sizeText?.replace(/\D+/g, "") ?? "0", 10)).toBeGreaterThan(0);
  await expect(page.getByText(/Preview [0-9a-f]{12}/i)).toBeVisible();
  await expect(page.getByText("1 immutable version stored for this logical document.")).toBeVisible();
  await expect(page.getByText(/Extracted text items:/i)).toBeVisible();
  await expect(page.getByText(/Image operators: 0/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toContain("Fixture_Candidate");
  expect(suggestedFilename.endsWith(".pdf")).toBe(true);
  const downloadPath = test.info().outputPath(suggestedFilename);
  await download.saveAs(downloadPath);
  const downloadedFile = await fs.readFile(downloadPath);
  expect(downloadedFile.byteLength).toBeGreaterThan(0);

  const loadingTask = getDocument({
    data: new Uint8Array(downloadedFile),
    standardFontDataUrl: `${pathToFileURL(
      path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")
    ).href}/`
  });
  const pdf = await loadingTask.promise;
  const extractedPages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pdfPage = await pdf.getPage(pageNumber);
    const textContent = await pdfPage.getTextContent();
    extractedPages.push(
      textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    );
  }
  const extractedText = extractedPages.join("\n");
  const metadata = await pdf.getMetadata();
  const metadataInfo = metadata.info as Record<string, unknown>;
  await loadingTask.destroy();

  expect(extractedText).toContain(candidateName);
  expect(extractedText).toContain("Professional Summary");
  expect(extractedText).toContain("Core Skills");
  expect(extractedText).toContain("Professional Experience");
  expect(
    extractedText.includes(approvedRoleBullet) || extractedText.includes(approvedAccomplishmentBullet)
  ).toBe(true);
  if (extractedText.includes("Selected Projects")) {
    expect(extractedText).toContain(approvedProject);
  }
  expect(extractedText).not.toContain("Shortened the summary and trimmed optional content for a tighter employer-facing pass.");
  expect(extractedText).not.toContain("I acknowledge the remaining non-blocking warnings.");
  expect(extractedText).not.toContain("exp_fixture");
  expect(extractedText).not.toContain("project_fixture");
  expect(extractedText).not.toContain("candidate_fixture");
  expect(extractedText).not.toContain("sourceEvidenceIds");
  expect(extractedText).not.toContain("resumeRevisionVersionId");
  expect(extractedText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(metadataInfo.Title).toBe(`${companyName} ${roleName} Resume`);
  expect(metadataInfo.Producer).toBe("Career Operating System");
  expect(JSON.stringify(metadataInfo)).not.toContain("resumeRevisionVersionId");
  expect(JSON.stringify(metadataInfo)).not.toContain("sourceEvidenceIds");

  await page.getByRole("link", { name: "Open application" }).click();
  await expect(statusCard).toContainText(initialStatusText.trim());
  await expect(statusHistorySection.locator("article")).toHaveCount(initialStatusHistoryCount);
  const rerenderRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/applications/${applicationId}`) &&
      response.status() === 303
  );
  await page.getByRole("button", { name: "Render Resume PDF Again" }).click();
  const rerenderResponse = await rerenderRequest;
  expect(rerenderResponse.status()).toBe(303);
  await expect(
    page.getByText(
      "The active approved resume already had a matching immutable PDF, so the existing document version was reused."
    )
  ).toBeVisible();
  await page.getByRole("link", { name: "View Resume PDF" }).click();
  await expect(page.getByText("1 immutable version stored for this logical document.")).toBeVisible();
  const reusedDocumentHref = page.url();
  expect(reusedDocumentHref.endsWith(renderedDocumentHref ?? "")).toBe(true);

  await page.getByRole("link", { name: "Open application" }).click();
  await page.getByRole("button", { name: "Create Structured Resume Plan" }).click();
  await expect(
    page.getByText(
      "The current structured resume contract, engine, and configuration already had a successful result for this exact match report and career profile, so the existing plan was reused."
    )
  ).toBeVisible();
  await page.getByRole("button", { name: "Run Resume Audit Again" }).click();
  await expect(
    page.getByText(
      "The current audit contract, engine, and configuration already had a successful result for this exact composed resume, so the existing audit was reused."
    )
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate Match Report" }).click();
  await expect(
    page.getByText(
      "The current report contract, engine, and configuration already had a successful result for this exact scoring run, so the existing match report was reused."
    )
  ).toBeVisible();
  await expect(statusCard).toContainText(initialStatusText.trim());
  await expect(statusHistorySection.locator("article")).toHaveCount(initialStatusHistoryCount);
  await page.getByRole("link", { name: "View Match Report" }).click();
  await expect(page.getByRole("link", { name: "Candidate Evidence" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Evidence Scores" }).click();
  await page.getByRole("link", { name: "Back to Candidate Evidence" }).click();
  await expect(page.getByRole("link", { name: "View Evidence Scores" })).toBeVisible();
  await page.getByRole("link", { name: "Open application" }).click();
  await expect(page.getByText("Evidence Scored")).toBeVisible();
  await expect(page.getByText(/scott-v1/)).toBeVisible();
  await expect(page.getByText(/scott-v1 .* strong required/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "View Evidence Scores" })).toBeVisible();
  await page.getByRole("button", { name: "Score Retrieved Evidence" }).click();
  await expect(
    page.getByText(
      "The current scoring contract, engine, and configuration already had a successful result for this exact retrieval run, so the existing scoring run was reused."
    )
  ).toBeVisible();
  await page.getByRole("link", { name: "View Confirmed Requirements", exact: true }).first().click();
  await expect(page.getByRole("link", { name: "View Candidate Evidence" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Evidence Scores" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Match Report" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Structured Resume Plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Revised Analysis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Excluded items" })).toBeVisible();

  await page.getByRole("button", { name: "Create Revised Analysis" }).click();
  await expect(page.getByText("A revised requirement analysis draft was created.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Requirement Analysis" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Description" }).click();
  await expect(page.getByText("Original text")).toBeVisible();
  await expect(page.getByText("Experience mentoring engineers")).toBeVisible();
  await page.getByRole("button", { name: "Reparse with Current Parser" }).click();
  await expect(
    page.getByText(
      "The current parser version already had a successful result, so the existing parse was reused."
    )
  ).toBeVisible();

  await page.getByRole("link", { name: "View predecessor (v1)" }).click();
  await expect(page.getByText("Superseded")).toBeVisible();
  await expect(page.getByText("Improve observability and deployment safety")).toBeVisible();
  await expect(page.getByText("Experience mentoring engineers")).toHaveCount(0);

  await Promise.all([
    page.waitForURL(/\/applications\/[^/]+$/, { timeout: 15_000 }),
    page.getByRole("link", { name: "Open application" }).click()
  ]);
  await Promise.all([
    page.waitForURL(/\/applications\/[^/]+\/job-description$/, { timeout: 15_000 }),
    page.getByRole("link", { name: "Replace Job Description" }).click()
  ]);
  await expect(page.getByRole("heading", { name: "Replace job description" })).toBeVisible();
  await page.getByRole("textbox", { name: "Job description text" }).fill(secondDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(
    page.getByText(
      "That exact job description already existed for this opportunity, so the existing version was linked without creating a duplicate."
    )
  ).toBeVisible();
  await expect(page.getByText("2 versions")).toBeVisible();

  await page.goto("/applications");
  await page.getByLabel("Applications view").selectOption("system:all-active");
  await page.getByRole("searchbox", { name: "Search applications" }).fill(companyName);
  await expect(
    grid.locator('.ag-cell[col-id="company"]').filter({ hasText: companyName })
  ).toHaveCount(1);
  const statusCell = grid
    .locator(".ag-row")
    .filter({ hasText: companyName })
    .locator('.ag-cell[col-id="status"]')
    .filter({ hasText: initialStatusValue });
  await expect(statusCell).toHaveCount(1);
  const statusRowIndex = await page.evaluate((companyNameValue) => {
    const api = window.__careerOsApplicationsGrid?.api;
    if (!api) {
      throw new Error("Grid API is unavailable.");
    }

    let rowIndex: number | null = null;
    api.forEachNodeAfterFilterAndSort((node) => {
      if (rowIndex !== null) {
        return;
      }

      if (node.data?.company === companyNameValue && typeof node.rowIndex === "number") {
        rowIndex = node.rowIndex;
      }
    });

    return rowIndex;
  }, companyName);
  expect(statusRowIndex).not.toBeNull();
  await page.evaluate((rowIndex) => {
    const api = window.__careerOsApplicationsGrid?.api;
    if (!api || rowIndex == null) {
      throw new Error("Grid API is unavailable.");
    }

    api.ensureIndexVisible(rowIndex);
    api.startEditingCell({
      rowIndex,
      colKey: "status"
    });
  }, statusRowIndex);
  const statusEditor = page.getByRole("combobox", { name: "Status editor" });
  await expect(statusEditor).toBeVisible();
  const statusSaveResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().includes("/api/applications/") ||
      !response.url().includes("/grid-field")
    ) {
      return false;
    }

    const payload = response.request().postDataJSON() as { field?: string } | null;
    return payload?.field === "status";
  });
  await statusEditor.selectOption(nextStatusValue);
  await statusSaveResponse;

  await expect(
    page.getByRole("status").filter({ hasText: "Application updated." }).first()
  ).toContainText("Application updated.");
  await expect(
    grid
      .locator(".ag-row")
      .filter({ hasText: companyName })
      .locator('.ag-cell[col-id="status"]')
      .filter({ hasText: nextStatusValue })
  ).toHaveCount(1);
});

function preparedApplicationIdFromUrl(url: string) {
  const match = url.match(/\/applications\/([^/?]+)/);
  if (!match?.[1]) {
    throw new Error(`Could not determine application id from url: ${url}`);
  }

  return match[1];
}

const RENDERING_WARNING_ACKNOWLEDGEMENT =
  "I acknowledge the remaining non-blocking warnings.";
const COVER_LETTER_WARNING_ACKNOWLEDGEMENT =
  "I acknowledge the remaining non-blocking warnings.";

async function approveCoverLetter(
  page: Page,
  options: { required: boolean }
) {
  const approvalSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Approval" }) })
    .first();
  await expect(approvalSection).toBeVisible();

  const warningCheckbox = approvalSection.getByRole("checkbox", {
    name: /approve this cover letter despite/i
  });
  if ((await warningCheckbox.count()) > 0) {
    await warningCheckbox.check();
    const acknowledgementField = approvalSection.getByRole("textbox", {
      name: "Required acknowledgement"
    });
    await acknowledgementField.fill(COVER_LETTER_WARNING_ACKNOWLEDGEMENT);
    await expect(acknowledgementField).toHaveValue(COVER_LETTER_WARNING_ACKNOWLEDGEMENT);
  }

  const approvalButton = approvalSection.getByRole("button", { name: "Approve Cover Letter" });
  const alreadyActiveMessage = approvalSection.getByText(
    "The exact approved cover letter was already active, so the existing record was reused."
  );
  if (await alreadyActiveMessage.count()) {
    return true;
  }

  if (!(await approvalButton.isEnabled())) {
    if (!options.required) {
      return false;
    }
  }

  if (!options.required && !(await approvalButton.isEnabled())) {
    return false;
  }

  await expect(approvalButton).toBeEnabled();
  const approvalRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/cover-letter-approvals"),
    { timeout: 15_000 }
  );
  await approvalButton.click();
  await approvalRequest;
  await expect(
    page.getByText(/Cover-letter approval is now active|existing record was reused/i)
  ).toBeVisible({ timeout: 15_000 });
  return true;
}

async function approveForRendering(
  page: Page,
  options: { required: boolean }
) {
  const warningCheckbox = page.getByRole("checkbox", {
    name: /approve this resume despite/i
  });
  if ((await warningCheckbox.count()) > 0) {
    await warningCheckbox.check();
    const acknowledgementField = page.getByRole("textbox", {
      name: "Required acknowledgement"
    });
    await acknowledgementField.fill(RENDERING_WARNING_ACKNOWLEDGEMENT);
    await expect(acknowledgementField).toHaveValue(RENDERING_WARNING_ACKNOWLEDGEMENT);
  }

  const approvalButton = page.getByRole("button", { name: "Approve for Rendering" });
  const alreadyActiveMessage = page.getByText(
    "The proposed content is already the active approved resume for rendering."
  );
  if (await alreadyActiveMessage.count()) {
    return true;
  }

  if (!(await approvalButton.isEnabled())) {
    if (await alreadyActiveMessage.count()) {
      return true;
    }
    if (!options.required) {
      return false;
    }
  }

  if (!options.required && !(await approvalButton.isEnabled())) {
    return false;
  }

  await expect(approvalButton).toBeEnabled();
  const approvalRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/resume-rendering-approvals"),
    { timeout: 15_000 }
  );
  await approvalButton.click();
  await approvalRequest;
  await expect(
    page.getByText(/Rendering approval is now active|existing record was reused/i)
  ).toBeVisible({ timeout: 15_000 });
  return true;
}
