import type { CanonicalCareerKnowledgeContract } from "@/lib/career/contracts";
import type { MatchReportResult } from "@/lib/match-report/contract";
import type { StatementProvenance } from "@/lib/resume-composition/contract";
import {
  RESUME_AUDIT_CONFIGURATION_VERSION,
  RESUME_AUDIT_CONTRACT_VERSION,
  RESUME_AUDIT_ENGINE_VERSION,
  resumeAuditConfiguration
} from "@/lib/resume-audit/config";
import {
  type ResumeAuditInput,
  type ResumeAuditResult,
  resumeAuditInputSchema
} from "@/lib/resume-audit/contract";
import type { StructuredResumePlan } from "@/lib/structured-resume/contract";

type Section =
  | "HEADER"
  | "PROFESSIONAL_SUMMARY"
  | "CORE_SKILLS"
  | "PROFESSIONAL_EXPERIENCE"
  | "SELECTED_PROJECTS"
  | "EDUCATION"
  | "CERTIFICATIONS";

type Severity = "ERROR" | "WARNING" | "INFORMATION";
type Category = ResumeAuditResult["findings"][number]["category"];
type Finding = ResumeAuditResult["findings"][number];
type StatementResult = ResumeAuditResult["statementResults"][number];

type BuildResumeAuditArgs = {
  input: ResumeAuditInput;
  careerProfile: CanonicalCareerKnowledgeContract;
  structuredResumePlan: StructuredResumePlan;
  matchReport: MatchReportResult;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%+ ]+/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildFinding(args: {
  ruleId: string;
  severity: Severity;
  category: Category;
  message: string;
  statementId?: string | null;
  section?: Section | null;
  sourceEvidenceIds?: string[];
  sourceCareerRecordIds?: string[];
  requirementIds?: string[];
  actualValue?: string | null;
  expectedCondition?: string | null;
  blocksRendering?: boolean;
  userReviewable?: boolean;
  templateId?: string | null;
}) {
  const actualValue = args.actualValue ?? null;
  return {
    findingId: [args.ruleId, args.statementId ?? "global", args.section ?? "global", actualValue ?? "na"]
      .map((part) => normalizeText(part))
      .join(":"),
    ruleId: args.ruleId,
    severity: args.severity,
    category: args.category,
    message: args.message,
    statementId: args.statementId ?? null,
    section: args.section ?? null,
    sourceEvidenceIds: args.sourceEvidenceIds ?? [],
    sourceCareerRecordIds: args.sourceCareerRecordIds ?? [],
    requirementIds: args.requirementIds ?? [],
    actualValue,
    expectedCondition: args.expectedCondition ?? null,
    renderingImpact:
      (args.blocksRendering ?? args.severity === "ERROR") ? "Blocks rendering." : "Warning only.",
    suggestedHandling: "Review the upstream resume plan, composition, or source evidence and rerun the audit.",
    provenance: {
      templateId: args.templateId ?? null,
      sourcePath: null
    },
    blocksRendering: args.blocksRendering ?? args.severity === "ERROR",
    userReviewable: args.userReviewable ?? args.severity !== "ERROR"
  } satisfies Finding;
}

function buildRecordMaps(careerProfile: CanonicalCareerKnowledgeContract) {
  return {
    employment: new Map(careerProfile.employment.map((item) => [item.id, item])),
    projects: new Map(careerProfile.projects.map((item) => [item.id, item])),
    skills: new Map(careerProfile.skills.map((item) => [item.id, item])),
    education: new Map(careerProfile.education.map((item) => [item.id, item])),
    certifications: new Map(careerProfile.certifications.map((item) => [item.id, item])),
    evidence: new Map(careerProfile.evidence.map((item) => [item.id, item]))
  };
}

function findSourceTexts(
  provenance: StatementProvenance,
  maps: ReturnType<typeof buildRecordMaps>,
  careerProfile: CanonicalCareerKnowledgeContract
) {
  const values = new Set<string>();
  for (const id of provenance.sourceCareerRecordIds) {
    if (id === careerProfile.candidate.id) {
      values.add(careerProfile.candidate.displayName);
      values.add(careerProfile.candidate.contacts.email ?? "");
      values.add(careerProfile.candidate.contacts.phone ?? "");
      values.add(careerProfile.candidate.location ?? "");
      values.add(careerProfile.candidate.contacts.linkedinUrl ?? "");
      values.add(careerProfile.candidate.contacts.githubUrl ?? "");
    }
    const employment = maps.employment.get(id);
    if (employment) {
      values.add(employment.employer);
      values.add(employment.roleTitle);
      values.add(employment.startDate?.normalized ?? "");
      values.add(employment.endDate?.normalized ?? "");
      employment.technologies.forEach((value) => values.add(value));
      employment.accomplishments.forEach((value) => values.add(value));
      employment.responsibilities.forEach((value) => values.add(value));
      employment.metrics.forEach((value) => {
        values.add(value.value ?? "");
        values.add((value.value ?? "").replace("%", " percent"));
      });
    }
    const project = maps.projects.get(id);
    if (project) {
      values.add(project.name);
      values.add(project.dates.startDate?.normalized ?? "");
      values.add(project.dates.endDate?.normalized ?? "");
      project.technologies.forEach((value) => values.add(value));
      project.accomplishments.forEach((value) => values.add(value));
      project.responsibilities.forEach((value) => values.add(value));
      project.metrics.forEach((value) => {
        values.add(value.value ?? "");
        values.add((value.value ?? "").replace("%", " percent"));
      });
    }
    const skill = maps.skills.get(id);
    if (skill) {
      values.add(skill.name);
    }
    const education = maps.education.get(id);
    if (education) {
      values.add(education.institution);
      values.add(education.degree);
      values.add(education.field ?? "");
      values.add(education.completionDate?.normalized ?? "");
    }
    const certification = maps.certifications.get(id);
    if (certification) {
      values.add(certification.name);
      values.add(certification.issuer ?? "");
      values.add(certification.awardDate?.normalized ?? "");
      values.add(certification.expirationDate?.normalized ?? "");
    }
  }
  for (const id of provenance.sourceEvidenceIds) {
    const evidence = maps.evidence.get(id);
    if (evidence) {
      values.add(evidence.claim);
      values.add(evidence.metric?.value ?? "");
      values.add((evidence.metric?.value ?? "").replace("%", " percent"));
      evidence.technologies.forEach((value) => values.add(value));
    }
  }
  return [...values].filter(Boolean).map((value) => normalizeText(value));
}

function hasQualificationLanguage(text: string) {
  const normalized = normalizeText(text);
  return ["project", "prior", "previous", "intermittent", "older", "expired"].some((token) =>
    normalized.includes(token)
  );
}

function buildStatementResult(
  statementId: string,
  section: Section,
  provenanceStatus: StatementResult["provenanceStatus"],
  truthfulnessStatus: StatementResult["truthfulnessStatus"],
  statementFindings: Finding[]
): StatementResult {
  const hasBlocking = statementFindings.some((finding) => finding.blocksRendering);
  const hasWarning = statementFindings.some((finding) => finding.severity === "WARNING");
  return {
    statementId,
    section,
    auditState: hasBlocking
      ? "BLOCKED"
      : truthfulnessStatus === "QUALIFIED"
        ? "QUALIFIED"
        : truthfulnessStatus === "NEEDS_REVIEW"
          ? "NEEDS_REVIEW"
          : "VERIFIED",
    provenanceStatus,
    truthfulnessStatus,
    renderingEligibility: hasBlocking
      ? "BLOCKED"
      : truthfulnessStatus === "NEEDS_REVIEW"
        ? "NEEDS_REVIEW"
        : hasWarning
          ? "WARN"
          : "ELIGIBLE",
    findingIds: statementFindings.map((finding) => finding.findingId)
  };
}

function findYearsClaims(text: string) {
  return [...text.matchAll(/(\d+)\+?\s+years?/gi)]
    .map((match) => Number.parseInt(match[1] ?? "0", 10))
    .filter(Number.isFinite);
}

export function buildResumeAudit(args: BuildResumeAuditArgs): ResumeAuditResult {
  const input = resumeAuditInputSchema.parse(args.input);
  const composition = input.resumeComposition;
  const maps = buildRecordMaps(args.careerProfile);
  const findings: Finding[] = [];
  const statementResults: StatementResult[] = [];
  const sectionFindingMap = new Map<Section, Finding[]>();

  const addFinding = (finding: Finding) => {
    findings.push(finding);
    if (finding.section) {
      const items = sectionFindingMap.get(finding.section as Section) ?? [];
      items.push(finding);
      sectionFindingMap.set(finding.section as Section, items);
    }
  };

  const auditStatement = (argsForStatement: {
    statementId: string;
    text: string;
    section: Section;
    provenance: StatementProvenance | null;
  }) => {
    const statementFindings: Finding[] = [];
    let provenanceStatus: StatementResult["provenanceStatus"] = "VALID";
    let truthfulnessStatus: StatementResult["truthfulnessStatus"] = "UNKNOWN";

    if (!argsForStatement.provenance) {
      provenanceStatus = "MISSING";
      statementFindings.push(
        buildFinding({
          ruleId: "provenance.missing",
          severity: "ERROR",
          category: "PROVENANCE",
          message: "Employer-facing content is missing provenance.",
          statementId: argsForStatement.statementId,
          section: argsForStatement.section,
          actualValue: argsForStatement.text,
          expectedCondition: "Every employer-facing statement must preserve provenance.",
          userReviewable: false
        })
      );
    } else {
      const provenance = argsForStatement.provenance;
      truthfulnessStatus = provenance.truthfulnessClassification;
      if (provenance.sourceEvidenceIds.length === 0 && provenance.sourceCareerRecordIds.length === 0) {
        provenanceStatus = "INVALID";
        statementFindings.push(
          buildFinding({
            ruleId: "provenance.missing-source",
            severity: "ERROR",
            category: "PROVENANCE",
            message: "Statement provenance has no source evidence or source record ids.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "At least one source record or evidence id must be present.",
            templateId: provenance.templateId
          })
        );
      }

      if (provenance.recordKinds.includes("AI_SUGGESTION")) {
        statementFindings.push(
          buildFinding({
            ruleId: "provenance.ai-suggestion",
            severity: "ERROR",
            category: "PROVENANCE",
            message: "AI suggestion provenance is not allowed in employer-facing content.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            sourceCareerRecordIds: provenance.sourceCareerRecordIds,
            sourceEvidenceIds: provenance.sourceEvidenceIds,
            actualValue: argsForStatement.text,
            expectedCondition: "Only source facts, confirmed records, and safe qualified composites are allowed.",
            templateId: provenance.templateId
          })
        );
      }

      if (truthfulnessStatus === "NEEDS_REVIEW") {
        statementFindings.push(
          buildFinding({
            ruleId: "truthfulness.needs-review",
            severity: "ERROR",
            category: "TRUTHFULNESS",
            message: "Statements marked NEEDS_REVIEW cannot be rendering-ready.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "Rendering-ready resumes must not include NEEDS_REVIEW statements.",
            templateId: provenance.templateId
          })
        );
      }

      if (truthfulnessStatus === "PROHIBITED") {
        statementFindings.push(
          buildFinding({
            ruleId: "truthfulness.prohibited",
            severity: "ERROR",
            category: "TRUTHFULNESS",
            message: "Prohibited statements cannot appear in employer-facing content.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "PROHIBITED content must be removed upstream.",
            templateId: provenance.templateId
          })
        );
      }

      if (truthfulnessStatus === "QUALIFIED" && !hasQualificationLanguage(argsForStatement.text)) {
        statementFindings.push(
          buildFinding({
            ruleId: "truthfulness.missing-qualifier",
            severity: "ERROR",
            category: "TRUTHFULNESS",
            message: "Qualified content is missing explicit limiting language.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "Qualified content must retain project, prior, intermittent, or similar language.",
            templateId: provenance.templateId
          })
        );
      }

      const sourceTexts = findSourceTexts(provenance, maps, args.careerProfile);
      const normalizedText = normalizeText(argsForStatement.text);
      if (
        normalizedText &&
        sourceTexts.length > 0 &&
        argsForStatement.section !== "PROFESSIONAL_SUMMARY" &&
        !sourceTexts.some((value) => normalizedText.includes(value) || value.includes(normalizedText))
      ) {
        statementFindings.push(
          buildFinding({
            ruleId: "source-fidelity.mismatch",
            severity: "ERROR",
            category: "CONTRACT",
            message: "Rendered statement does not align closely enough with its cited source values.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            sourceCareerRecordIds: provenance.sourceCareerRecordIds,
            sourceEvidenceIds: provenance.sourceEvidenceIds,
            actualValue: argsForStatement.text,
            expectedCondition: "Rendered factual content must preserve upstream employer, title, project, education, certification, and metric facts.",
            templateId: provenance.templateId
          })
        );
      }

      for (const metric of argsForStatement.text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []) {
        if (!sourceTexts.some((value) => value.includes(normalizeText(metric)))) {
          statementFindings.push(
            buildFinding({
              ruleId: "metric.unsupported",
              severity: "ERROR",
              category: "METRIC",
              message: `Metric ${metric} is not supported by the cited source evidence.`,
              statementId: argsForStatement.statementId,
              section: argsForStatement.section,
              sourceCareerRecordIds: provenance.sourceCareerRecordIds,
              sourceEvidenceIds: provenance.sourceEvidenceIds,
              actualValue: metric,
              expectedCondition: "Rendered metrics must appear in upstream source evidence.",
              templateId: provenance.templateId
            })
          );
        }
      }
    }

    for (const claim of findYearsClaims(argsForStatement.text)) {
      if (claim > resumeAuditConfiguration.experience.maxYearsPerSkill) {
        statementFindings.push(
          buildFinding({
            ruleId: "experience.over-eight-years",
            severity: "ERROR",
            category: "EXPERIENCE",
            message: `Experience claim of ${claim} years exceeds the eight-year cap.`,
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: `${claim} years`,
            expectedCondition: "No skill or technology claim may exceed eight years."
          })
        );
      }
      if (
        input.maximumRequestedExperienceYears !== null &&
        claim > input.maximumRequestedExperienceYears + resumeAuditConfiguration.experience.maxYearsBeyondJobRequirement
      ) {
        statementFindings.push(
          buildFinding({
            ruleId: "experience.over-job-cap",
            severity: "ERROR",
            category: "EXPERIENCE",
            message: `Experience claim of ${claim} years exceeds the job-aligned cap.`,
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: `${claim} years`,
            expectedCondition: `Do not exceed requested experience by more than ${resumeAuditConfiguration.experience.maxYearsBeyondJobRequirement} years.`
          })
        );
      }
    }

    const normalizedText = normalizeText(argsForStatement.text);
    for (const phrase of resumeAuditConfiguration.style.prohibitedPhrases) {
      if (normalizedText.includes(normalizeText(phrase))) {
        statementFindings.push(
          buildFinding({
            ruleId: "style.prohibited-tone",
            severity: phrase === "expert" || phrase === "seasoned" ? "ERROR" : "WARNING",
            category: "STYLE",
            message: `Statement uses discouraged phrase "${phrase}".`,
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "Avoid unsupported expertise claims and generic corporate adjectives.",
            blocksRendering: phrase === "expert" || phrase === "seasoned"
          })
        );
      }
    }

    if (/\b(i|me|my)\b/i.test(argsForStatement.text) && resumeAuditConfiguration.style.disallowFirstPerson) {
      statementFindings.push(
        buildFinding({
          ruleId: "style.first-person",
          severity: "WARNING",
          category: "STYLE",
          message: "First-person language is discouraged in the current resume configuration.",
          statementId: argsForStatement.statementId,
          section: argsForStatement.section,
          actualValue: argsForStatement.text,
          expectedCondition: "Employer-facing resume content should avoid first-person pronouns."
        })
      );
    }

    for (const character of resumeAuditConfiguration.ats.prohibitedCharacters) {
      if (argsForStatement.text.includes(character)) {
        statementFindings.push(
          buildFinding({
            ruleId: "ats.prohibited-character",
            severity: "ERROR",
            category: "ATS",
            message: "Statement contains a prohibited ATS-hostile character.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "Employer-facing content must avoid em dashes and unsupported control characters."
          })
        );
      }
    }

    for (const token of resumeAuditConfiguration.privacy.blockedTokens) {
      if (normalizedText.includes(token)) {
        statementFindings.push(
          buildFinding({
            ruleId: "privacy.internal-metadata",
            severity: "ERROR",
            category: "PRIVACY",
            message: "Statement appears to expose internal metadata.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: argsForStatement.text,
            expectedCondition: "Rendered content must not expose checksums, source paths, or internal metadata.",
            userReviewable: false
          })
        );
      }
    }

    if (argsForStatement.section !== "PROFESSIONAL_SUMMARY") {
      const words = wordCount(argsForStatement.text);
      if (words > resumeAuditConfiguration.bullets.errorAboveWords) {
        statementFindings.push(
          buildFinding({
            ruleId: "bullet.long",
            severity: "ERROR",
            category: "SEVEN_SECOND_SCAN",
            message: "Bullet exceeds the configured maximum word count.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: `${words} words`,
            expectedCondition: `${resumeAuditConfiguration.bullets.errorAboveWords} words or fewer.`
          })
        );
      } else if (words > resumeAuditConfiguration.bullets.warningAboveWords) {
        statementFindings.push(
          buildFinding({
            ruleId: "bullet.long",
            severity: "WARNING",
            category: "SEVEN_SECOND_SCAN",
            message: "Bullet is longer than the preferred recruiter-scan threshold.",
            statementId: argsForStatement.statementId,
            section: argsForStatement.section,
            actualValue: `${words} words`,
            expectedCondition: `${resumeAuditConfiguration.bullets.warningAboveWords} words or fewer.`
          })
        );
      }
    }

    statementFindings.forEach(addFinding);
    statementResults.push(
      buildStatementResult(
        argsForStatement.statementId,
        argsForStatement.section,
        provenanceStatus,
        truthfulnessStatus,
        statementFindings
      )
    );
  };

  for (const entry of composition.header.filter((item) => item.included && item.value)) {
    auditStatement({
      statementId: entry.provenance?.statementId ?? `header:${entry.field.toLowerCase()}`,
      text: entry.value ?? "",
      section: "HEADER",
      provenance: entry.provenance
    });
  }

  for (const sentence of composition.professionalSummary.sentences) {
    auditStatement({
      statementId: sentence.statementId,
      text: sentence.text,
      section: "PROFESSIONAL_SUMMARY",
      provenance: sentence.provenance
    });
  }

  for (const group of composition.skillsGroups) {
    for (const skill of group.skills) {
      auditStatement({
        statementId: skill.provenance.statementId,
        text: skill.displayValue,
        section: "CORE_SKILLS",
        provenance: skill.provenance
      });
      if ((skill.recency === "STALE" || (!skill.professionalUse && skill.projectUse)) && !skill.qualificationText) {
        addFinding(
          buildFinding({
            ruleId: "skills.unqualified-restricted-skill",
            severity: "ERROR",
            category: skill.recency === "STALE" ? "RECENCY" : "PROJECT_CONTEXT",
            message: "Stale or project-only skill is shown without qualification.",
            statementId: skill.provenance.statementId,
            section: "CORE_SKILLS",
            actualValue: skill.displayValue,
            expectedCondition: "Restricted skills must keep qualification text."
          })
        );
      }
    }
  }

  for (const role of composition.professionalExperience) {
    auditStatement({
      statementId: role.provenance.statementId,
      text: [role.roleTitle, role.employer, role.startDate, role.endDate].filter(Boolean).join(" | "),
      section: "PROFESSIONAL_EXPERIENCE",
      provenance: role.provenance
    });
    const sourceRole = maps.employment.get(role.roleId);
    if (!sourceRole) {
      addFinding(
        buildFinding({
          ruleId: "role.missing-source-role",
          severity: "ERROR",
          category: "OTHER",
          message: `Professional experience role ${role.roleId} could not be resolved in the career profile.`,
          statementId: role.provenance.statementId,
          section: "PROFESSIONAL_EXPERIENCE",
          actualValue: role.roleId,
          expectedCondition: "Rendered roles must map to a known employment record."
        })
      );
    } else if (role.employer !== sourceRole.employer || role.roleTitle !== sourceRole.roleTitle) {
      addFinding(
        buildFinding({
          ruleId: "source-fidelity.mismatch",
          severity: "ERROR",
          category: "CONTRACT",
          message: "Rendered role header does not match the source employer or role title.",
          statementId: role.provenance.statementId,
          section: "PROFESSIONAL_EXPERIENCE",
          sourceCareerRecordIds: [sourceRole.id],
          actualValue: `${role.roleTitle ?? ""} @ ${role.employer ?? ""}`,
          expectedCondition: `${sourceRole.roleTitle} @ ${sourceRole.employer}`
        })
      );
    }
    for (const bullet of role.bullets) {
      auditStatement({
        statementId: bullet.statementId,
        text: bullet.text,
        section: "PROFESSIONAL_EXPERIENCE",
        provenance: bullet.provenance
      });
      if (bullet.provenance.sourceCareerRecordIds.some((id) => maps.projects.has(id))) {
        addFinding(
          buildFinding({
            ruleId: "project.professional-misrepresentation",
            severity: "ERROR",
            category: "PROJECT_CONTEXT",
            message: "Professional experience bullet relies on project-only source records.",
            statementId: bullet.statementId,
            section: "PROFESSIONAL_EXPERIENCE",
            sourceCareerRecordIds: bullet.provenance.sourceCareerRecordIds,
            actualValue: bullet.text,
            expectedCondition: "Project-only work must remain clearly labeled as project work."
          })
        );
      }
    }
  }

  for (const project of composition.selectedProjects) {
    auditStatement({
      statementId: project.provenance.statementId,
      text: [project.projectName, project.contextLabel].filter(Boolean).join(" | "),
      section: "SELECTED_PROJECTS",
      provenance: project.provenance
    });
    for (const bullet of project.bullets) {
      auditStatement({
        statementId: bullet.statementId,
        text: bullet.text,
        section: "SELECTED_PROJECTS",
        provenance: bullet.provenance
      });
    }
  }

  for (const education of composition.education) {
    auditStatement({
      statementId: education.provenance.statementId,
      text: [education.degree, education.field, education.institution, education.completionDate]
        .filter(Boolean)
        .join(" | "),
      section: "EDUCATION",
      provenance: education.provenance
    });
  }

  for (const certification of composition.certifications) {
    auditStatement({
      statementId: certification.provenance.statementId,
      text: [certification.name, certification.issuer, certification.currentDisplay].filter(Boolean).join(" | "),
      section: "CERTIFICATIONS",
      provenance: certification.provenance
    });
    const sourceCertification = maps.certifications.get(certification.certificationId);
    if (sourceCertification?.status === "EXPIRED" && normalizeText(certification.currentDisplay).includes("current")) {
      addFinding(
        buildFinding({
          ruleId: "certification.expired-presented-current",
          severity: "ERROR",
          category: "CERTIFICATION",
          message: "Expired certification is presented as current.",
          statementId: certification.provenance.statementId,
          section: "CERTIFICATIONS",
          sourceCareerRecordIds: [certification.certificationId],
          actualValue: certification.currentDisplay,
          expectedCondition: "Expired certifications must be excluded or explicitly marked expired."
        })
      );
    }
  }

  const normalizedBullets = new Set<string>();
  for (const role of composition.professionalExperience) {
    for (const bullet of role.bullets) {
      const normalized = normalizeText(bullet.text);
      if (normalizedBullets.has(normalized)) {
        addFinding(
          buildFinding({
            ruleId: "duplication.duplicate-bullet",
            severity: "WARNING",
            category: "DUPLICATION",
            message: "A near-duplicate bullet appears more than once.",
            statementId: bullet.statementId,
            section: "PROFESSIONAL_EXPERIENCE",
            actualValue: bullet.text,
            expectedCondition: "Duplicate bullet content should not repeat."
          })
        );
      } else {
        normalizedBullets.add(normalized);
      }
    }
  }

  const allSkills = composition.skillsGroups.flatMap((group) => group.skills);
  const seenSkills = new Set<string>();
  for (const skill of allSkills) {
    const normalized = normalizeText(skill.canonicalValue);
    if (seenSkills.has(normalized)) {
      addFinding(
        buildFinding({
          ruleId: "duplication.repeated-skill",
          severity: "WARNING",
          category: "DUPLICATION",
          message: `Skill ${skill.displayValue} appears more than once across skill groups.`,
          section: "CORE_SKILLS",
          actualValue: skill.displayValue,
          expectedCondition: "Avoid repeated skill aliases and duplicate entries."
        })
      );
    } else {
      seenSkills.add(normalized);
    }
  }

  if (composition.professionalSummary.wordCount < resumeAuditConfiguration.summary.minimumWords) {
    addFinding(
      buildFinding({
        ruleId: "summary.short",
        severity: "WARNING",
        category: "SEVEN_SECOND_SCAN",
        message: "Summary is shorter than the preferred minimum.",
        section: "PROFESSIONAL_SUMMARY",
        actualValue: `${composition.professionalSummary.wordCount} words`,
        expectedCondition: `${resumeAuditConfiguration.summary.minimumWords}+ words when evidence supports it.`
      })
    );
  }
  if (composition.professionalSummary.wordCount > resumeAuditConfiguration.summary.maximumWords) {
    addFinding(
      buildFinding({
        ruleId: "summary.long",
        severity: "WARNING",
        category: "SEVEN_SECOND_SCAN",
        message: "Summary exceeds the configured maximum.",
        section: "PROFESSIONAL_SUMMARY",
        actualValue: `${composition.professionalSummary.wordCount} words`,
        expectedCondition: `${resumeAuditConfiguration.summary.maximumWords} words or fewer.`
      })
    );
  }

  if (allSkills.length > resumeAuditConfiguration.skills.errorAboveCount) {
    addFinding(
      buildFinding({
        ruleId: "skills.excessive-count",
        severity: "ERROR",
        category: "KEYWORD",
        message: "Total skill count exceeds the configured maximum.",
        section: "CORE_SKILLS",
        actualValue: `${allSkills.length} skills`,
        expectedCondition: `${resumeAuditConfiguration.skills.errorAboveCount} or fewer skills.`
      })
    );
  } else if (allSkills.length > resumeAuditConfiguration.skills.warningAboveCount) {
    addFinding(
      buildFinding({
        ruleId: "skills.excessive-count",
        severity: "WARNING",
        category: "KEYWORD",
        message: "Total skill count is above the preferred threshold.",
        section: "CORE_SKILLS",
        actualValue: `${allSkills.length} skills`,
        expectedCondition: `${resumeAuditConfiguration.skills.warningAboveCount} or fewer skills when possible.`
      })
    );
  }

  if (composition.professionalExperience.length === 0) {
    addFinding(
      buildFinding({
        ruleId: "completeness.missing-role",
        severity: "ERROR",
        category: "OTHER",
        message: "Resume does not include a professional experience role.",
        section: "PROFESSIONAL_EXPERIENCE",
        expectedCondition: "At least one professional role is required."
      })
    );
  }
  if (composition.professionalExperience.every((role) => role.bullets.length === 0)) {
    addFinding(
      buildFinding({
        ruleId: "completeness.no-evidence-bullets",
        severity: "ERROR",
        category: "OTHER",
        message: "Resume does not include any evidence-backed professional bullets.",
        section: "PROFESSIONAL_EXPERIENCE",
        expectedCondition: "At least one evidence-backed bullet is required."
      })
    );
  }

  const firstThirdText = normalizeText([
    composition.professionalSummary.text,
    ...allSkills.slice(0, 8).map((skill) => skill.displayValue),
    ...composition.professionalExperience.slice(0, 1).flatMap((role) => role.bullets.slice(0, 3).map((bullet) => bullet.text))
  ].join(" "));
  const missingPriorityTech = args.matchReport.resumeGuidance.priorityTechnologies
    .filter((item) => item.guidance === "INCLUDE")
    .map((item) => item.technology)
    .filter((technology) => !firstThirdText.includes(normalizeText(technology)));
  if (missingPriorityTech.length > 0) {
    addFinding(
      buildFinding({
        ruleId: "relevance.first-third",
        severity: "WARNING",
        category: "RELEVANCE",
        message: "The first third of the resume does not surface all priority supported technologies.",
        actualValue: missingPriorityTech.join(", "),
        expectedCondition: "Strong supported target technologies should appear early."
      })
    );
  }

  for (const claim of input.matchReportClaimsToAvoid) {
    const normalizedClaim = normalizeText(claim);
    const visibleText = normalizeText([
      composition.professionalSummary.text,
      ...composition.professionalExperience.flatMap((role) => role.bullets.map((bullet) => bullet.text)),
      ...composition.selectedProjects.flatMap((project) => project.bullets.map((bullet) => bullet.text))
    ].join(" "));
    if (visibleText.includes(normalizedClaim)) {
      addFinding(
        buildFinding({
          ruleId: "relevance.claims-to-avoid",
          severity: "ERROR",
          category: "RELEVANCE",
          message: `Resume includes claim-to-avoid concept "${claim}".`,
          actualValue: claim,
          expectedCondition: "Claims-to-avoid from the match report must not appear in the composed resume."
        })
      );
    }
  }

  if (composition.summary.estimatedPageCount > resumeAuditConfiguration.pageBudget.maximumPages) {
    addFinding(
      buildFinding({
        ruleId: "page-budget.over-budget",
        severity: "ERROR",
        category: "PAGE_BUDGET",
        message: "Estimated page count exceeds the configured maximum.",
        actualValue: `${composition.summary.estimatedPageCount}`,
        expectedCondition: `${resumeAuditConfiguration.pageBudget.maximumPages} pages or fewer.`
      })
    );
  } else if (
    composition.summary.pageBudgetStatus === "AT_RISK" ||
    composition.summary.estimatedPageCount > resumeAuditConfiguration.pageBudget.targetPages
  ) {
    addFinding(
      buildFinding({
        ruleId: "page-budget.at-risk",
        severity: "WARNING",
        category: "PAGE_BUDGET",
        message: "Estimated page count is at risk of exceeding the target budget.",
        actualValue: `${composition.summary.estimatedPageCount}`,
        expectedCondition: `${resumeAuditConfiguration.pageBudget.targetPages} target pages.`
      })
    );
  }

  const sections: Section[] = [
    "HEADER",
    "PROFESSIONAL_SUMMARY",
    "CORE_SKILLS",
    "PROFESSIONAL_EXPERIENCE",
    "SELECTED_PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS"
  ];

  const sectionResults = sections.map((section) => {
    const items = sectionFindingMap.get(section) ?? [];
    return {
      sectionType: section,
      renderingReadiness: (
        items.some((item) => item.blocksRendering)
          ? "BLOCKED"
          : items.some((item) => item.severity === "WARNING")
            ? "READY_WITH_WARNINGS"
            : "READY_FOR_RENDERING"
      ) as ResumeAuditResult["sectionResults"][number]["renderingReadiness"],
      passedChecks: items.length === 0 ? ["section.ok"] : [],
      warningFindingIds: items.filter((item) => item.severity === "WARNING").map((item) => item.findingId),
      errorFindingIds: items.filter((item) => item.severity === "ERROR").map((item) => item.findingId)
    };
  });

  const errorCount = findings.filter((finding) => finding.severity === "ERROR").length;
  const warningCount = findings.filter((finding) => finding.severity === "WARNING").length;
  const informationCount = findings.filter((finding) => finding.severity === "INFORMATION").length;
  const statementsVerified = statementResults.filter((result) => result.auditState === "VERIFIED").length;
  const statementsQualified = statementResults.filter((result) => result.auditState === "QUALIFIED").length;
  const statementsNeedingReview = statementResults.filter((result) => result.auditState === "NEEDS_REVIEW").length;
  const statementsProhibited = statementResults.filter((result) => result.auditState === "BLOCKED").length;

  const renderingReadiness = errorCount > 0
    ? "BLOCKED"
    : statementsNeedingReview > 0
      ? "NEEDS_REVIEW"
      : warningCount > 0
        ? "READY_WITH_WARNINGS"
        : "READY_FOR_RENDERING";
  const status = renderingReadiness === "BLOCKED"
    ? "FAILED"
    : renderingReadiness === "NEEDS_REVIEW"
      ? "NEEDS_REVIEW"
      : warningCount > 0
        ? "PASSED_WITH_WARNINGS"
        : "PASSED";

  return {
    runId: input.runId,
    workspaceId: input.workspaceId,
    resumeCompositionVersionId: input.resumeCompositionVersionId,
    resumeRevisionVersionId: input.resumeRevisionVersionId,
    structuredResumeVersionId: composition.structuredResumeVersionId,
    careerProfileVersionId: composition.careerProfileVersionId,
    matchReportRunId: composition.matchReportRunId,
    requirementAnalysisId: composition.requirementAnalysisId,
    jobDescriptionVersionId: composition.jobDescriptionVersionId,
    applicationId: composition.applicationId,
    resumeAuditContractVersion: RESUME_AUDIT_CONTRACT_VERSION,
    resumeAuditEngineVersion: RESUME_AUDIT_ENGINE_VERSION,
    resumeAuditConfigurationVersion: RESUME_AUDIT_CONFIGURATION_VERSION,
    resumeCompositionInputChecksum: input.resumeCompositionInputChecksum,
    inputChecksum: input.inputChecksum,
    createdAt: input.createdAt,
    status,
    renderingReadiness,
    diagnostics: [],
    summary: {
      auditStatus: status,
      renderingReadiness,
      errorCount,
      warningCount,
      informationCount,
      statementsAudited: statementResults.length,
      statementsVerified,
      statementsQualified,
      statementsNeedingReview,
      statementsProhibited,
      unsupportedClaimCount: findings.filter((item) => item.ruleId.startsWith("truthfulness.") || item.ruleId.startsWith("source-fidelity.")).length,
      missingProvenanceCount: findings.filter((item) => item.ruleId.startsWith("provenance.")).length,
      experienceViolationCount: findings.filter((item) => item.category === "EXPERIENCE").length,
      metricViolationCount: findings.filter((item) => item.category === "METRIC").length,
      projectContextViolationCount: findings.filter((item) => item.category === "PROJECT_CONTEXT").length,
      certificationViolationCount: findings.filter((item) => item.category === "CERTIFICATION").length,
      atsBlockerCount: findings.filter((item) => item.category === "ATS" && item.blocksRendering).length,
      sevenSecondScanWarningCount: findings.filter((item) => item.category === "SEVEN_SECOND_SCAN").length,
      duplicationFindingCount: findings.filter((item) => item.category === "DUPLICATION").length,
      pageBudgetStatus: composition.summary.pageBudgetStatus
    },
    sectionResults,
    statementResults,
    findings
  };
}
