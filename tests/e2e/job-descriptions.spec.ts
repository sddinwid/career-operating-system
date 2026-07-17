import { expect, test } from "@playwright/test";

test("captures, versions, and reuses job descriptions without changing application workflow state", async ({
  page
}) => {
  test.setTimeout(65_000);
  const companyName = "E2E Grid Company";
  const roleName = "E2E Grid Role";
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
  const initialStatusValue = initialStatusText.includes("INTERVIEW")
    ? "INTERVIEW"
    : "APPLIED";
  const nextStatusValue = initialStatusValue === "APPLIED" ? "INTERVIEW" : "APPLIED";
  const statusHistorySection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Status history" }) });
  const initialStatusHistoryCount = await statusHistorySection.locator("article").count();

  await expect(
    page.getByText("No job description has been saved for this application yet.")
  ).toBeVisible();

  await page.getByRole("link", { name: "Add Job Description" }).click();
  await expect(
    page.getByRole("heading", { name: "Add job description" })
  ).toBeVisible();

  const descriptionField = page.getByRole("textbox", { name: "Job description text" });
  await descriptionField.fill(firstDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(page.getByText("Job description saved successfully.")).toBeVisible();
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

  await expect(page.getByText("Job description saved successfully.")).toBeVisible();
  await expect(page.getByText("2 versions")).toBeVisible();
  await expect(page.getByText("2").first()).toBeVisible();

  await page.getByRole("link", { name: "View version" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View predecessor (v1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Parse Job Description" })).toBeVisible();
  await page.getByRole("button", { name: "Parse Job Description" }).click();

  await expect(page.getByText("Job description parsed successfully.")).toBeVisible();
  await expect(page.getByText("SUCCESS", { exact: true })).toBeVisible();
  await expect(page.getByText("m3.2.0")).toBeVisible();
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
  await expect(page.getByText("5 years with TypeScript")).toBeVisible();
  await expect(page.getByText(/\d+ errors, \d+ warnings, \d+ info/)).toBeVisible();

  await page.getByRole("link", { name: "Review Requirements" }).click();
  await expect(page.getByRole("heading", { name: "Needs Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contextual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Responsibilities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noise" })).toBeVisible();
  const contextualCard = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Contextual" }) })
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

  await page.getByLabel(/I acknowledge the remaining low-confidence items/i).check();
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
  await page.getByRole("link", { name: "View Candidate Evidence" }).click();
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
  await page.getByRole("link", { name: "View Evidence Scores" }).click();
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
  await page.getByRole("link", { name: "View Match Report" }).click();
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
  await expect(page.getByRole("button", { name: "Create Structured Resume Plan" })).toBeVisible();
  await page.getByRole("button", { name: "Create Structured Resume Plan" }).click();
  await expect(page.getByText("Structured resume plan created successfully.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Structured Resume Plan" })).toBeVisible();
  await page.getByRole("link", { name: "View Structured Resume Plan" }).click();
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
  await expect(page.getByText(/docx/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Compose Targeted Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Compose Targeted Resume" }).click();
  await expect(page.getByText("Targeted resume composed successfully.")).toBeVisible();
  await expect(page.getByText("Targeted resume preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Resume Audit" })).toBeVisible();
  await expect(page.getByText(/\u2014/)).toHaveCount(0);
  await page.getByRole("button", { name: "Run Resume Audit" }).click();
  await expect(page.getByText("Resume audit completed successfully.")).toBeVisible();
  await expect(page.getByText(/READY FOR RENDERING|READY WITH WARNINGS|NEEDS REVIEW|BLOCKED/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Resume Audit" })).toBeVisible();
  await page.getByRole("link", { name: "View Resume Audit" }).click();
  await expect(page.getByText("Resume audit report")).toBeVisible();
  await expect(page.getByText("Page budget")).toBeVisible();
  await expect(page.getByText("Statement Findings")).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume Composition" })).toBeVisible();
  await expect(page.getByText(/docx/i)).toHaveCount(0);
  await expect(page.getByText(/pdf/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Resume Studio" })).toBeVisible();
  await page.getByRole("link", { name: "Open Resume Studio" }).click();
  await expect(page.getByText("Resume Studio")).toBeVisible();

  const summarySection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Professional Summary" }) });
  const summaryTextarea = summarySection.getByRole("textbox", { name: "Revised" });
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
  if ((await projectSection.count()) > 0) {
    const projectCheckboxes = projectSection.locator('input[type="checkbox"]');
    if ((await projectCheckboxes.count()) > 0) {
      await projectCheckboxes.first().uncheck();
    }
  }

  await page
    .getByRole("textbox", { name: "Revision note" })
    .fill("Shortened the summary and trimmed optional content for a tighter employer-facing pass.");
  await page.getByRole("button", { name: "Save Draft" }).click();
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
  if ((await page.getByRole("textbox", { name: "Required acknowledgement" }).count()) > 0) {
    await page.getByRole("checkbox", { name: /approve this resume despite/i }).check();
    await page
      .getByRole("textbox", { name: "Required acknowledgement" })
      .fill("I acknowledge the remaining non-blocking warnings.");
  }
  await page.getByRole("button", { name: "Approve for Rendering" }).click();
  await expect(
    page.getByText(
      /Rendering approval is now active|existing record was reused/i
    )
  ).toBeVisible();
  await expect(page.getByText("Approval History")).toBeVisible();
  await page.getByRole("link", { name: "Back to Revision" }).click();
  await expect(page.getByRole("link", { name: "Create New Revision" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Create New Revision" }).first().click();
  await expect(page.getByText("Resume Studio")).toBeVisible();
  await expect(page.getByText("Predecessor revision")).toBeVisible();
  await expect(page.getByText(/docx/i)).toHaveCount(0);
  await expect(page.getByText(/pdf/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Resume Preview" }).click();
  await page.getByRole("link", { name: "Open application" }).click();
  await expect(page.getByText("Match report summary")).toBeVisible();
  await expect(page.getByText("Structured Resume Plan Generated")).toBeVisible();
  await expect(page.getByText("Resume Audit Complete")).toBeVisible();
  await expect(page.getByText(/Active Approval|No Active Approval/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Comparison" })).toBeVisible();
  await expect(page.getByText(/Resume Generation Ready|Match Report Generated|Match Report Has Critical Gaps|Resume Generation Ready With Limitations/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View Match Report" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Structured Resume Plan" })).toBeVisible();
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
  await page.getByRole("link", { name: "View Confirmed Requirements" }).click();
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

  await page.getByRole("link", { name: "Open application" }).click();
  await page.getByRole("link", { name: "Replace Job Description" }).click();
  await page.getByRole("textbox", { name: "Job description text" }).fill(secondDescription);
  await page.getByRole("button", { name: "Save job description" }).click();

  await expect(
    page.getByText(
      "That exact job description already existed for this opportunity, so the existing version was linked without creating a duplicate."
    )
  ).toBeVisible();
  await expect(page.getByText("2 versions")).toBeVisible();

  await page.goto("/applications");
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
  await statusCell.dblclick();
  const statusEditor = page.getByRole("combobox", { name: "Status editor" });
  await expect(statusEditor).toBeVisible();
  await statusEditor.selectOption(nextStatusValue);

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
