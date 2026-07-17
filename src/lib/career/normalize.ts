import {
  type CanonicalCareerKnowledgeContract,
  CAREER_CONTRACT_VERSION,
  type SourceCareerKnowledge
} from "@/lib/career/contracts";
import {
  repositoryCareerRuleEntries,
  repositoryExperienceClaimRules,
  repositoryStackOrderingRules
} from "@/lib/career/rules";
import {
  ensureObject,
  ensureString,
  ensureStringArray,
  normalizeDateString,
  normalizeUrl,
  slugify
} from "@/lib/career/utils";

function provenance(sourceSection: string, sourceId: string | null, sourcePath: string) {
  return {
    sourceSection,
    sourceId,
    sourcePath
  };
}

function sourceConfirmationState(
  evidenceLevel: unknown
): "SOURCE_PROVIDED" | "VERIFIED" | "PROJECT_VERIFIED" {
  if (evidenceLevel === "verified") {
    return "VERIFIED";
  }

  if (evidenceLevel === "project_verified") {
    return "PROJECT_VERIFIED";
  }

  return "SOURCE_PROVIDED";
}

function generatedId(prefix: string, parts: Array<string | null>) {
  return `${prefix}_${slugify(parts.filter(Boolean).join("_")) || "item"}`;
}

function normalizeMetric(value: unknown, verificationState: "SOURCE_PROVIDED" | "VERIFIED" | "PROJECT_VERIFIED" = "SOURCE_PROVIDED") {
  const metric = ensureObject(value);

  return {
    description: ensureString(metric.description),
    value:
      typeof metric.value === "number"
        ? String(metric.value)
        : ensureString(metric.value),
    verificationState
  };
}

export function normalizeCareerKnowledgeSource(
  source: SourceCareerKnowledge
): CanonicalCareerKnowledgeContract {
  const meta = ensureObject(source._meta);
  const candidateProfile = ensureObject(source.candidateProfile);
  const resumeGenerationRules = ensureObject(source.resumeGenerationRules);
  const writingPreferences = ensureObject(source.writingPreferences);

  const employment = source.professionalExperience.map((item, index) => {
    const record = ensureObject(item);
    const id =
      ensureString(record._id) ??
      generatedId("employment", [
        ensureString(record.company),
        ensureString(record.title),
        String(index)
      ]);

    const metrics = Array.isArray(record.metrics)
      ? record.metrics.map((metric) => normalizeMetric(metric, "VERIFIED"))
      : [];

    return {
      id,
      employer: ensureString(record.company) ?? `Unknown employer ${index + 1}`,
      roleTitle: ensureString(record.title) ?? `Unknown role ${index + 1}`,
      startDate: normalizeDateString(record.startDate),
      endDate: normalizeDateString(record.endDate),
      employmentType: ensureString(record.employmentType) ?? ensureString(record.employmentStructure),
      location: ensureString(record.location),
      workArrangement: ensureString(record.workArrangement),
      domainTags: ensureStringArray(record.domainTags),
      themes: ensureStringArray(record.themes),
      responsibilities: ensureStringArray(record.resumeBullets),
      accomplishments: ensureStringArray(record.accomplishments),
      technologies: ensureStringArray(record.technologies),
      metrics,
      facts: ensureStringArray(record.facts),
      leadershipScope: ensureString(record.leadershipScope),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "SOURCE_PROVIDED" as const,
      provenance: provenance("professionalExperience", id, `professionalExperience[${index}]`)
    };
  });

  const projects = source.projects.map((item, index) => {
    const record = ensureObject(item);
    const id =
      ensureString(record._id) ??
      generatedId("project", [ensureString(record.name), String(index)]);

    return {
      id,
      name: ensureString(record.name) ?? `Unknown project ${index + 1}`,
      purpose: ensureString(record.type),
      status: ensureString(record.status),
      role: ensureString(record.role),
      context:
        ensureString(record.context) === "professional"
          ? ("PROFESSIONAL" as const)
          : ensureString(record.context) === "personal"
            ? ("PERSONAL" as const)
            : ("UNKNOWN" as const),
      dates: {
        startDate: normalizeDateString(record.startDate),
        endDate: normalizeDateString(record.endDate)
      },
      architecture: ensureStringArray(record.themes),
      technologies: ensureStringArray(record.technologies),
      responsibilities: ensureStringArray(record.responsibilities),
      accomplishments: ensureStringArray(record.accomplishments),
      metrics: Array.isArray(record.metrics)
        ? record.metrics.map((metric) => normalizeMetric(metric, "PROJECT_VERIFIED"))
        : [],
      tradeoffs: ensureStringArray(record.tradeoffs),
      links: ensureStringArray(record.links).map((value) => normalizeUrl(value) ?? value),
      domainTags: ensureStringArray(record.domainTags),
      preferredFor: ensureStringArray(record.preferredFor),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "PROJECT_VERIFIED" as const,
      provenance: provenance("projects", id, `projects[${index}]`)
    };
  });

  const evidence: CanonicalCareerKnowledgeContract["evidence"] = [];

  const pushEvidence = (
    sectionName: string,
    items: Array<Record<string, unknown>>,
    map: (
      record: Record<string, unknown>,
      index: number
    ) => CanonicalCareerKnowledgeContract["evidence"][number]
  ) => {
    for (const [index, record] of items.entries()) {
      evidence.push(map(record, index));
    }
  };

  pushEvidence(
    "accomplishments",
    source.accomplishments.map((item) => ensureObject(item)),
    (record, index) => {
      const id =
        ensureString(record._id) ??
        generatedId("evidence", [ensureString(record.summary), String(index)]);
      const sourceId = ensureString(record.sourceId);
      const isProjectSource = ensureString(record.sourceType) === "project";
      return {
        id,
        evidenceType: "ACCOMPLISHMENT",
        claim: ensureString(record.summary) ?? `Accomplishment ${index + 1}`,
        context: ensureString(record.sourceType),
        metric: record.metric ? normalizeMetric(record.metric, sourceConfirmationState(record.evidenceLevel)) : null,
        associatedEmploymentId: isProjectSource ? null : sourceId,
        associatedProjectId: isProjectSource ? sourceId : null,
        technologies: ensureStringArray(record.skills),
        roleFamilyRelevance: ensureStringArray(record.bestFor),
        themes: ensureStringArray(record.themes),
        priority: typeof record.priority === "number" ? record.priority : null,
        recordKind: "SOURCE_FACT",
        confirmationState: sourceConfirmationState(record.evidenceLevel),
        provenance: provenance("accomplishments", id, `accomplishments[${index}]`)
      };
    }
  );

  pushEvidence(
    "resumeBullets",
    source.resumeBullets.map((item) => ensureObject(item)),
    (record, index) => {
      const id =
        ensureString(record._id) ??
        generatedId("bullet", [ensureString(record.text), String(index)]);
      const sourceId = ensureString(record.sourceId);
      const isProject = sourceId?.startsWith("project_") ?? false;
      return {
        id,
        evidenceType: "RESUME_BULLET",
        claim: ensureString(record.text) ?? `Resume bullet ${index + 1}`,
        context: null,
        metric: null,
        associatedEmploymentId: isProject ? null : sourceId,
        associatedProjectId: isProject ? sourceId : null,
        technologies: ensureStringArray(record.skills),
        roleFamilyRelevance: [],
        themes: ensureStringArray(record.themes),
        priority: typeof record.priority === "number" ? record.priority : null,
        recordKind: "SOURCE_FACT",
        confirmationState: sourceConfirmationState(record.evidenceLevel),
        provenance: provenance("resumeBullets", id, `resumeBullets[${index}]`)
      };
    }
  );

  pushEvidence(
    "architectureExamples",
    source.architectureExamples.map((item) => ensureObject(item)),
    (record, index) => {
      const id =
        ensureString(record._id) ??
        generatedId("architecture", [ensureString(record.problem), String(index)]);
      return {
        id,
        evidenceType: "ARCHITECTURE",
        claim: ensureString(record.approach) ?? `Architecture example ${index + 1}`,
        context: ensureString(record.problem),
        metric: null,
        associatedEmploymentId: null,
        associatedProjectId: ensureString(record.sourceId),
        technologies: [],
        roleFamilyRelevance: ensureStringArray(record.bestFor),
        themes: ensureStringArray(record.tradeoffs),
        priority: null,
        recordKind: "SOURCE_FACT",
        confirmationState: "PROJECT_VERIFIED",
        provenance: provenance("architectureExamples", id, `architectureExamples[${index}]`)
      };
    }
  );

  pushEvidence(
    "leadershipExamples",
    source.leadershipExamples.map((item) => ensureObject(item)),
    (record, index) => {
      const id =
        ensureString(record._id) ??
        generatedId("leadership", [ensureString(record.summary), String(index)]);
      const sourceId = ensureString(record.sourceId);
      const isProject = sourceId?.startsWith("project_") ?? false;
      return {
        id,
        evidenceType: "LEADERSHIP",
        claim: ensureString(record.summary) ?? `Leadership example ${index + 1}`,
        context: null,
        metric: null,
        associatedEmploymentId: isProject ? null : sourceId,
        associatedProjectId: isProject ? sourceId : null,
        technologies: [],
        roleFamilyRelevance: ensureStringArray(record.bestFor),
        themes: [],
        priority: null,
        recordKind: "SOURCE_FACT",
        confirmationState: sourceConfirmationState(record.evidenceLevel),
        provenance: provenance("leadershipExamples", id, `leadershipExamples[${index}]`)
      };
    }
  );

  pushEvidence(
    "productionExamples",
    source.productionExamples.map((item) => ensureObject(item)),
    (record, index) => {
      const id =
        ensureString(record._id) ??
        generatedId("production", [ensureString(record.summary), String(index)]);
      const sourceId = ensureString(record.sourceId);
      const isProject = sourceId?.startsWith("project_") ?? false;
      return {
        id,
        evidenceType: "PRODUCTION",
        claim: ensureString(record.summary) ?? `Production example ${index + 1}`,
        context: null,
        metric: null,
        associatedEmploymentId: isProject ? null : sourceId,
        associatedProjectId: isProject ? sourceId : null,
        technologies: [],
        roleFamilyRelevance: [],
        themes: ensureStringArray(record.themes),
        priority: null,
        recordKind: "SOURCE_FACT",
        confirmationState: "SOURCE_PROVIDED",
        provenance: provenance("productionExamples", id, `productionExamples[${index}]`)
      };
    }
  );

  const evidenceIdSet = new Set(evidence.map((item) => item.id));

  const skills = source.skills.map((item, index) => {
    const record = ensureObject(item);
    const id =
      ensureString(record._id) ??
      generatedId("skill", [ensureString(record.name), String(index)]);
    const skillName = ensureString(record.name) ?? `Skill ${index + 1}`;
    const referencedEvidence = evidence
      .filter((entry) =>
        entry.technologies.some((technology) => technology.toLowerCase() === skillName.toLowerCase())
      )
      .map((entry) => entry.id)
      .filter((entryId) => evidenceIdSet.has(entryId));

    return {
      id,
      name: skillName,
      category: ensureString(record.category),
      professionalUse: null,
      projectUse: null,
      firstUse: normalizeDateString(record.firstUse),
      lastUse: normalizeDateString(record.lastUse),
      recency:
        record.recent === true
          ? ("CURRENT" as const)
          : record.recent === false
            ? ("STALE" as const)
            : ("UNKNOWN" as const),
      confidence: "HIGH" as const,
      evidenceReferences: referencedEvidence,
      notes: ensureString(record.notes),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "SOURCE_PROVIDED" as const,
      provenance: provenance("skills", id, `skills[${index}]`)
    };
  });

  const education = source.education.map((item, index) => {
    const record = ensureObject(item);
    const institution = ensureString(record.institution) ?? `Institution ${index + 1}`;
    const degree = ensureString(record.degree) ?? `Degree ${index + 1}`;
    const yearValue =
      typeof record.year === "number" ? String(record.year) : ensureString(record.year);
    return {
      id:
        ensureString(record._id) ??
        generatedId("education", [institution, degree, String(index)]),
      institution,
      degree,
      field: ensureString(record.field),
      completionDate: yearValue ? normalizeDateString(yearValue) : null,
      status: ensureString(record.status),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "SOURCE_PROVIDED" as const,
      provenance: provenance("education", null, `education[${index}]`)
    };
  });

  const certifications = source.certifications.map((item, index) => {
    const record = ensureObject(item);
    const name = ensureString(record.name) ?? `Certification ${index + 1}`;
    const statusValue = ensureString(record.status)?.toLowerCase();
    const status =
      statusValue === "expired"
        ? ("EXPIRED" as const)
        : statusValue === "current"
          ? ("CURRENT" as const)
          : ("UNKNOWN" as const);
    const confirmationState =
      status === "EXPIRED"
        ? ("EXPIRED_REFERENCE" as const)
        : ("SOURCE_PROVIDED" as const);
    return {
      id:
        ensureString(record._id) ??
        generatedId("certification", [name, ensureString(record.specialization), String(index)]),
      name,
      issuer: ensureString(record.issuer) ?? ensureString(record.specialization),
      awardDate: normalizeDateString(record.awardDate),
      expirationDate: normalizeDateString(record.expirationDate),
      status,
      includeByDefault:
        typeof record.includeByDefault === "boolean" ? record.includeByDefault : null,
      recordKind: "SOURCE_FACT" as const,
      confirmationState,
      provenance: provenance("certifications", null, `certifications[${index}]`)
    };
  });

  const interviewStories = source.interviewStories.map((item, index) => {
    const record = ensureObject(item);
    const id =
      ensureString(record._id) ??
      generatedId("story", [ensureString(record.title), String(index)]);
    return {
      id,
      title: ensureString(record.title) ?? `Story ${index + 1}`,
      situation: ensureString(record.situation) ?? "",
      task: ensureString(record.task) ?? "",
      action: ensureString(record.action) ?? "",
      result: ensureString(record.result) ?? "",
      associatedCompetencies: ensureStringArray(record.themes),
      supportingEvidenceIds: ensureStringArray(record.sourceIds),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: sourceConfirmationState(record.evidenceLevel),
      provenance: provenance("interviewStories", id, `interviewStories[${index}]`)
    };
  });

  const sourceGlobalRules = ensureStringArray(resumeGenerationRules.globalRules).map(
    (description, index) => ({
      id: `source_rule_${index + 1}`,
      category: "source_global_rule",
      description,
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "SOURCE_PROVIDED" as const,
      provenance: provenance(
        "resumeGenerationRules.globalRules",
        null,
        `resumeGenerationRules.globalRules[${index}]`
      )
    })
  );

  const sourceStackOrderingRules = Object.entries(
    ensureObject(resumeGenerationRules.stackOrderingRules)
  ).map(([key, value]) => {
    const record = ensureObject(value);
    return {
      id: `source_stack_${slugify(key)}`,
      roleFamily: key,
      priorityOrder: ensureStringArray(record.priorityOrder),
      secondaryOrder: undefined,
      notes: ensureStringArray(record.notes),
      preferredEvidenceIds: ensureStringArray(record.preferredEvidence),
      recordKind: "SOURCE_FACT" as const,
      confirmationState: "SOURCE_PROVIDED" as const,
      provenance: provenance(
        "resumeGenerationRules.stackOrderingRules",
        null,
        `resumeGenerationRules.stackOrderingRules.${key}`
      )
    };
  });

  return {
    schemaVersion: CAREER_CONTRACT_VERSION,
    sourceSchemaVersion: ensureString(meta.schemaVersion),
    candidate: {
      id:
        ensureString(candidateProfile._id) ??
        generatedId("candidate", [ensureString(candidateProfile.name)]),
      displayName: ensureString(candidateProfile.name) ?? "Unknown Candidate",
      contacts: {
        email: ensureString(candidateProfile.email),
        phone: ensureString(candidateProfile.phone),
        linkedinUrl: normalizeUrl(candidateProfile.linkedin),
        githubUrl: normalizeUrl(candidateProfile.github)
      },
      location: ensureString(candidateProfile.location),
      targetRoles: ensureStringArray(candidateProfile.primaryTargetRoles),
      targetRolePositioning: Object.fromEntries(
        Object.entries(ensureObject(candidateProfile.preferredPositioning)).flatMap(
          ([key, value]) => (typeof value === "string" ? [[key, value]] : [])
        )
      ),
      careerThemes: ensureStringArray(candidateProfile.careerThemes),
      workPreferences: null,
      writingPreferences,
      knownUnknowns: source.knownUnknowns ?? [],
      recordKind: "SOURCE_FACT",
      confirmationState: "SOURCE_PROVIDED",
      provenance: provenance("candidateProfile", ensureString(candidateProfile._id), "candidateProfile")
    },
    generationRules: {
      globalRules: [...sourceGlobalRules, ...repositoryCareerRuleEntries],
      stackOrderingRules: [...sourceStackOrderingRules, ...repositoryStackOrderingRules],
      experienceClaimRules: repositoryExperienceClaimRules,
      coverLetterRules: ensureObject(resumeGenerationRules.coverLetterRules),
      recruiterOptimizationRules: ensureObject(resumeGenerationRules.recruiterOptimizationRules),
      jobDescriptionParsingRules: ensureObject(source.jobDescriptionParsingRules),
      jobMatchingRules: ensureObject(source.jobMatchingRules),
      outputGenerationWorkflow: {
        workflow: ensureObject(source.outputGenerationWorkflow),
        templates: ensureObject(source.outputTemplates)
      }
    },
    employment,
    projects,
    skills,
    education,
    certifications,
    evidence,
    interviewStories
  };
}
