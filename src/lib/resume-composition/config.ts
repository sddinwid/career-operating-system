export const RESUME_COMPOSITION_CONTRACT_VERSION = "1.0.0";
export const RESUME_COMPOSITION_ENGINE_VERSION = "m5.2.0";
export const RESUME_COMPOSITION_CONFIGURATION_VERSION = "scott-v1";

export const resumeCompositionConfiguration = {
  version: RESUME_COMPOSITION_CONFIGURATION_VERSION,
  summary: {
    minSentences: 2,
    maxSentences: 4,
    minWords: 45,
    maxWords: 80
  },
  pageBudget: {
    linesPerPage: 45
  },
  skillGroupLabels: {
    LANGUAGES: "Languages",
    BACKEND: "Backend",
    FRONTEND: "Frontend",
    DATA: "Data",
    CLOUD_INFRASTRUCTURE: "Cloud & Infrastructure",
    AI_ML: "AI & ML",
    ARCHITECTURE: "Architecture",
    DEVOPS: "DevOps",
    TESTING: "Testing",
    OTHER: "Additional"
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
  bulletConstraints: {
    minWords: 3,
    maxWords: 32
  },
  actionVerbs: [
    "Built",
    "Designed",
    "Developed",
    "Implemented",
    "Integrated",
    "Automated",
    "Improved",
    "Reduced",
    "Led",
    "Mentored",
    "Delivered",
    "Migrated",
    "Modernized",
    "Optimized",
    "Created",
    "Maintained",
    "Investigated"
  ],
  summaryTemplates: {
    GENERAL_BACKEND: "Backend software engineer focused on {focus}, with verified experience building {systems}. Works primarily with {technologies}. {differentiator}.",
    PYTHON_BACKEND: "Backend software engineer with verified experience building {systems} in Python-centric environments. Works primarily with {technologies}. {differentiator}.",
    NODE_TYPESCRIPT_BACKEND: "Backend software engineer focused on TypeScript and Node.js services, with verified experience building {systems}. Works primarily with {technologies}. {differentiator}.",
    MICROSOFT_DOTNET: "Backend and full-stack engineer with verified experience building {systems} using Microsoft-focused stacks. Works primarily with {technologies}. {differentiator}.",
    JAVA_KOTLIN: "Backend engineer focused on JVM services, API development, and {focus}. Works primarily with {technologies}. {differentiator}.",
    AI_AGENTIC: "Software engineer building practical AI and agentic systems, including {focus}. Combines {technologies} with production-minded delivery. {differentiator}.",
    FULL_STACK: "Full-stack engineer with verified experience building {systems} across backend and frontend surfaces. Works primarily with {technologies}. {differentiator}.",
    TECHNICAL_LEADERSHIP: "Technical leader with verified experience delivering {systems} and guiding engineering execution. Works primarily with {technologies}. {differentiator}.",
    OTHER: "Software engineer with verified experience building {systems}. Works primarily with {technologies}. {differentiator}."
  }
} as const;
