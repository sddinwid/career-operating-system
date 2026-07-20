import type {
  DetectedSectionListOrientation,
  LevelApplicability,
  SectionType
} from "@/lib/job-descriptions/parser-contract";

type SectionAliasDefinition = {
  aliases: string[];
  canonicalHeading: string;
  hierarchyDepth: number;
  listOrientation: DetectedSectionListOrientation;
  parentType: SectionType | null;
  type: SectionType;
  levelApplicability: LevelApplicability;
};

export type SectionHeadingMatch = {
  canonicalHeading: string;
  hierarchyDepth: number;
  listOrientation: DetectedSectionListOrientation;
  parentType: SectionType | null;
  type: SectionType;
  levelApplicability: LevelApplicability;
};

export const SECTION_ALIAS_DEFINITIONS: SectionAliasDefinition[] = [
  {
    type: "RESPONSIBILITIES",
    canonicalHeading: "What You'll Do",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: [
      "responsibilities",
      "essential duties & responsibilities",
      "essential duties and responsibilities",
      "what you'll do",
      "what you will do",
      "your impact",
      "the role",
      "what you'll be doing",
      "what you will be doing"
    ]
  },
  {
    type: "REQUIRED_QUALIFICATIONS",
    canonicalHeading: "Required Qualifications",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: [
      "requirements",
      "required qualifications",
      "minimum qualifications",
      "qualifications",
      "what we're looking for",
      "what you bring",
      "must have",
      "basic qualifications"
    ]
  },
  {
    type: "PREFERRED_QUALIFICATIONS",
    canonicalHeading: "Preferred Qualifications",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: [
      "preferred qualifications",
      "nice to have",
      "bonus points",
      "preferred experience",
      "preferred",
      "ideal candidate",
      "nice-to-have experience",
      "desired attributes"
    ]
  },
  {
    type: "SKILLS",
    canonicalHeading: "Skills",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["skills", "technical skills", "core skills", "stack"]
  },
  {
    type: "CORE_COMPETENCIES",
    canonicalHeading: "Core Competencies",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: ["core competencies", "core competencies all levels"]
  },
  {
    type: "TECHNICAL_CRAFT",
    canonicalHeading: "Technical Craft",
    parentType: "CORE_COMPETENCIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["technical craft"]
  },
  {
    type: "IMPACT_EXECUTION",
    canonicalHeading: "Impact & Execution",
    parentType: "CORE_COMPETENCIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["impact & execution", "impact and execution"]
  },
  {
    type: "COLLABORATION_INFLUENCE",
    canonicalHeading: "Collaboration & Influence",
    parentType: "CORE_COMPETENCIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["collaboration & influence", "collaboration and influence"]
  },
  {
    type: "CULTURE_GROWTH",
    canonicalHeading: "Culture & Growth",
    parentType: "CORE_COMPETENCIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["culture & growth", "culture and growth"]
  },
  {
    type: "HIGHER_LEVEL_RESPONSIBILITIES",
    canonicalHeading: "Higher-Level Responsibilities",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "UNSPECIFIED",
    aliases: ["higher-level responsibilities", "higher level responsibilities"]
  },
  {
    type: "REQUIRED_QUALIFICATIONS",
    canonicalHeading: "At the Senior level, you may",
    parentType: "HIGHER_LEVEL_RESPONSIBILITIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "SENIOR_ONLY",
    aliases: ["at the senior level, you may", "at the senior level you may"]
  },
  {
    type: "REQUIRED_QUALIFICATIONS",
    canonicalHeading: "At the Staff level, you may",
    parentType: "HIGHER_LEVEL_RESPONSIBILITIES",
    hierarchyDepth: 1,
    listOrientation: "LIST",
    levelApplicability: "STAFF_ONLY",
    aliases: ["at the staff level, you may", "at the staff level you may"]
  },
  {
    type: "COMPANY_VALUES",
    canonicalHeading: "Our Values",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["our values"]
  },
  {
    type: "COMPENSATION",
    canonicalHeading: "Compensation",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: ["compensation", "salary", "pay range", "salary range"]
  },
  {
    type: "BENEFITS",
    canonicalHeading: "Benefits",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "LIST",
    levelApplicability: "ALL_LEVELS",
    aliases: ["benefits", "perks", "what we offer", "benefits summary", "marathon benefits summary"]
  },
  {
    type: "LOCATION",
    canonicalHeading: "Location",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: ["location", "work location", "where you'll work"]
  },
  {
    type: "ABOUT_COMPANY",
    canonicalHeading: "About Company",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: ["about us", "about company", "about fieldguide", "who we are", "company overview"]
  },
  {
    type: "ABOUT_ROLE",
    canonicalHeading: "About the Role",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: [
      "about the role",
      "about the job",
      "about this role",
      "about this position",
      "position overview",
      "role overview"
    ]
  },
  {
    type: "EQUAL_OPPORTUNITY",
    canonicalHeading: "Equal Opportunity",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: [
      "equal opportunity",
      "eeo statement",
      "diversity and inclusion",
      "affirmative action"
    ]
  },
  {
    type: "APPLICATION_INSTRUCTIONS",
    canonicalHeading: "Application Instructions",
    parentType: null,
    hierarchyDepth: 0,
    listOrientation: "PARAGRAPH",
    levelApplicability: "ALL_LEVELS",
    aliases: ["how to apply", "application instructions", "next steps"]
  }
];

function normalizeHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[â€™']/g, "'")
    .replace(/[^a-z0-9'+/& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliasMap = new Map<string, SectionHeadingMatch>();

for (const definition of SECTION_ALIAS_DEFINITIONS) {
  for (const alias of definition.aliases) {
    aliasMap.set(normalizeHeading(alias), {
      type: definition.type,
      canonicalHeading: definition.canonicalHeading,
      parentType: definition.parentType,
      hierarchyDepth: definition.hierarchyDepth,
      listOrientation: definition.listOrientation,
      levelApplicability: definition.levelApplicability
    });
  }
}

export function resolveSectionHeading(heading: string): SectionHeadingMatch | null {
  return aliasMap.get(normalizeHeading(heading)) ?? null;
}

export function detectSectionTypeFromHeading(heading: string): SectionType {
  return resolveSectionHeading(heading)?.type ?? "OTHER";
}
