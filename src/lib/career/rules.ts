import type { CareerRuleEntry, CareerStackOrderingRule } from "@/lib/career/contracts";

function repoProvenance(sourcePath: string) {
  return {
    sourceSection: "repository_rules",
    sourceId: null,
    sourcePath
  };
}

export const repositoryCareerRuleEntries: CareerRuleEntry[] = [
  {
    id: "rule_never_invent_facts",
    category: "truthfulness",
    description: "Never invent facts.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_max_years_per_skill",
    category: "experience_claim",
    description:
      "Never claim more than eight total years of experience for an individual skill or technology.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_max_years_beyond_job_requirement",
    category: "experience_claim",
    description:
      "Do not exceed the job description's requested experience by more than five years where experience wording is used.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_no_intermittent_continuous_claims",
    category: "truthfulness",
    description: "Do not imply continuous use when use was intermittent.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_prefer_professional_evidence",
    category: "selection",
    description:
      "Prefer verified professional evidence over project evidence when relevance is equal.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_prefer_recent_evidence",
    category: "selection",
    description: "Prefer recent evidence.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_prefer_verified_metrics",
    category: "selection",
    description: "Prefer quantified impact when verified.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_no_keyword_stuffing",
    category: "writing",
    description: "Do not keyword-stuff.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_qualify_stale_skills",
    category: "writing",
    description: "Do not present stale skills as current without qualification.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_expired_certifications_reference_only",
    category: "certification",
    description:
      "Expired certifications remain reference data unless directly useful.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_cover_letter_not_resume_repeat",
    category: "cover_letter",
    description: "Cover letters must not restate the resume.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_cover_letter_concise_direct_natural",
    category: "cover_letter",
    description: "Cover letters should be concise, direct, and natural.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_cover_letter_focus",
    category: "cover_letter",
    description:
      "Cover letters should focus on why the role matters, why the employer should speak with Scott, and what kind of engineer Scott is.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "rule_no_em_dash",
    category: "writing",
    description: "Generated application writing should not use em dashes.",
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  }
];

export const repositoryStackOrderingRules: CareerStackOrderingRule[] = [
  {
    id: "stack_python_backend",
    roleFamily: "Python or General Backend",
    priorityOrder: [
      "Python",
      "Node.js",
      "TypeScript",
      "FastAPI",
      "NestJS",
      "AWS",
      "PostgreSQL",
      "Distributed systems"
    ],
    secondaryOrder: ["C#", ".NET", "ASP.NET", "Kotlin", "Spring Boot", "Java"],
    notes: [
      "Place Microsoft technologies later.",
      "Place Java and Kotlin last unless relevant to the role."
    ],
    preferredEvidenceIds: [],
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "stack_microsoft",
    roleFamily: "Microsoft",
    priorityOrder: [
      "C#",
      ".NET",
      "ASP.NET",
      "ASP.NET Core",
      "SQL Server",
      "Entity Framework",
      "Entity Framework Core",
      "React",
      "TypeScript"
    ],
    notes: ["Use only when supported by verified evidence."],
    preferredEvidenceIds: [],
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "stack_java_kotlin",
    roleFamily: "Java or Kotlin",
    priorityOrder: ["Kotlin", "Spring Boot", "Java"],
    secondaryOrder: ["Python", "Node.js", "C#", ".NET", "ASP.NET"],
    notes: [],
    preferredEvidenceIds: [],
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  },
  {
    id: "stack_ai_agentic",
    roleFamily: "AI and Agentic Roles",
    priorityOrder: [
      "AgentV",
      "AI Knowledge Search",
      "RAG",
      "LLM workflows",
      "Agent orchestration",
      "Tool invocation",
      "Evaluation",
      "Observability",
      "PostgreSQL",
      "pgvector",
      "Redis",
      "Docker",
      "AWS"
    ],
    notes: ["Prioritize verified evidence for AI-oriented roles."],
    preferredEvidenceIds: [],
    recordKind: "USER_CONFIRMED",
    confirmationState: "USER_CONFIRMED",
    provenance: repoProvenance("docs/REQUIREMENTS.md")
  }
];

export const repositoryExperienceClaimRules = {
  maxYearsPerSkill: 8,
  maxYearsBeyondJobRequirement: 5,
  disallowContinuousClaimsForIntermittentUse: true,
  preferProfessionalEvidenceWhenEqual: true,
  preferRecentEvidence: true,
  preferVerifiedMetrics: true,
  disallowKeywordStuffing: true,
  requireQualificationForStaleSkills: true,
  disallowEmDashInGeneratedWriting: true
};
