export const STRUCTURED_RESUME_CONTRACT_VERSION = "1.0.0";
export const RESUME_PLANNING_ENGINE_VERSION = "m5.1.0";
export const RESUME_PLANNING_CONFIGURATION_VERSION = "scott-v1";

export const structuredResumeConfiguration = {
  version: RESUME_PLANNING_CONFIGURATION_VERSION,
  pageBudget: {
    targetPages: 2,
    maximumPages: 2,
    linesPerPage: 45
  },
  summaryBlueprint: {
    minSentences: 2,
    maxSentences: 4,
    minWords: 45,
    maxWords: 80
  },
  sectionOrder: [
    "HEADER",
    "PROFESSIONAL_SUMMARY",
    "CORE_SKILLS",
    "PROFESSIONAL_EXPERIENCE",
    "SELECTED_PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS"
  ],
  sectionLineBudgets: {
    HEADER: 5,
    PROFESSIONAL_SUMMARY: 7,
    CORE_SKILLS: 9,
    PROFESSIONAL_EXPERIENCE: 24,
    SELECTED_PROJECTS: 8,
    EDUCATION: 4,
    CERTIFICATIONS: 3,
    ADDITIONAL_INFORMATION: 3
  },
  roleLimits: {
    includeLimit: 5,
    considerLimit: 2,
    backgroundLimit: 2
  },
  projectLimits: {
    includeLimit: 3,
    considerLimit: 2
  },
  bulletBudgets: {
    includedRole: 5,
    secondaryRole: 3,
    backgroundRole: 1,
    includedProject: 4,
    secondaryProject: 2
  },
  experienceClaimRules: {
    maxYearsPerSkill: 8,
    maxYearsBeyondJobRequirement: 5,
    disallowContinuousClaimsForIntermittentUse: true,
    preferProfessionalEvidenceWhenEqual: true,
    preferRecentEvidence: true,
    preferVerifiedMetrics: true,
    disallowKeywordStuffing: true,
    requireQualificationForStaleSkills: true,
    disallowEmDashInGeneratedWriting: true
  },
  stackRules: {
    GENERAL_BACKEND: {
      orderedTechnologyGroups: [
        ["Python", "Node.js", "TypeScript", "FastAPI", "NestJS"],
        ["AWS", "PostgreSQL", "Distributed Systems"],
        ["C#", ".NET", "ASP.NET Core"],
        ["Java", "Kotlin", "Spring Boot"]
      ],
      conditionalInclusions: ["Prefer backend evidence first."],
      deferredTechnologies: ["C#", ".NET", "ASP.NET Core", "Java", "Kotlin", "Spring Boot"],
      excludedTechnologies: []
    },
    PYTHON_BACKEND: {
      orderedTechnologyGroups: [
        ["Python", "FastAPI"],
        ["Node.js", "TypeScript", "NestJS"],
        ["AWS", "PostgreSQL", "Docker", "Distributed Systems"],
        ["C#", ".NET", "Java", "Kotlin"]
      ],
      conditionalInclusions: ["Prefer backend evidence first."],
      deferredTechnologies: ["C#", ".NET", "Java", "Kotlin"],
      excludedTechnologies: []
    },
    NODE_TYPESCRIPT_BACKEND: {
      orderedTechnologyGroups: [
        ["Node.js", "TypeScript", "NestJS", "React"],
        ["AWS", "PostgreSQL", "Docker", "Distributed Systems"],
        ["Python", "FastAPI"],
        ["C#", ".NET", "Java", "Kotlin"]
      ],
      conditionalInclusions: [],
      deferredTechnologies: ["C#", ".NET", "Java", "Kotlin"],
      excludedTechnologies: []
    },
    MICROSOFT_DOTNET: {
      orderedTechnologyGroups: [
        ["C#", ".NET", "ASP.NET", "ASP.NET Core", "SQL Server", "Entity Framework"],
        ["React", "TypeScript"],
        ["Python", "Node.js"],
        ["Java", "Kotlin"]
      ],
      conditionalInclusions: [],
      deferredTechnologies: ["Java", "Kotlin"],
      excludedTechnologies: []
    },
    JAVA_KOTLIN: {
      orderedTechnologyGroups: [
        ["Kotlin", "Spring Boot", "Java"],
        ["Python", "Node.js"],
        ["AWS", "PostgreSQL", "Docker"],
        ["C#", ".NET"]
      ],
      conditionalInclusions: [],
      deferredTechnologies: ["C#", ".NET"],
      excludedTechnologies: []
    },
    AI_AGENTIC: {
      orderedTechnologyGroups: [
        ["AgentV", "RAG", "LLM", "Agent Orchestration", "Tool Invocation", "Evaluation"],
        ["Observability", "PostgreSQL", "pgvector", "Redis", "Docker", "AWS"],
        ["Python", "Node.js", "TypeScript"]
      ],
      conditionalInclusions: ["Prefer verified agentic and evaluation evidence when available."],
      deferredTechnologies: [],
      excludedTechnologies: []
    },
    OTHER: {
      orderedTechnologyGroups: [["Backend", "Cloud", "Data"]],
      conditionalInclusions: [],
      deferredTechnologies: [],
      excludedTechnologies: []
    }
  },
  skillGroupOrder: [
    "LANGUAGES",
    "BACKEND",
    "FRONTEND",
    "DATA",
    "CLOUD_INFRASTRUCTURE",
    "AI_ML",
    "ARCHITECTURE",
    "DEVOPS",
    "TESTING",
    "OTHER"
  ],
  dateFormatPreference: "MMM YYYY",
  locationDisplayPreference: "CITY_REGION",
  contactInformationPolicy: {
    includeName: true,
    includeEmail: true,
    includePhone: true,
    includeLocation: true,
    includeLinkedIn: true,
    includeGitHub: true,
    includePortfolio: false,
    includeWorkAuthorizationNote: false
  }
} as const;
