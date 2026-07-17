import type { SectionType } from "@/lib/job-descriptions/parser-contract";

type SectionAliasDefinition = {
  type: SectionType;
  aliases: string[];
};

export const SECTION_ALIAS_DEFINITIONS: SectionAliasDefinition[] = [
  {
    type: "RESPONSIBILITIES",
    aliases: [
      "responsibilities",
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
    aliases: [
      "requirements",
      "required qualifications",
      "minimum qualifications",
      "what we're looking for",
      "what you bring",
      "must have",
      "basic qualifications"
    ]
  },
  {
    type: "PREFERRED_QUALIFICATIONS",
    aliases: [
      "preferred qualifications",
      "nice to have",
      "bonus points",
      "preferred experience",
      "preferred",
      "ideal candidate"
    ]
  },
  {
    type: "SKILLS",
    aliases: ["skills", "technical skills", "core skills", "stack"]
  },
  {
    type: "COMPENSATION",
    aliases: ["compensation", "salary", "pay range", "salary range"]
  },
  {
    type: "BENEFITS",
    aliases: ["benefits", "perks", "what we offer"]
  },
  {
    type: "LOCATION",
    aliases: ["location", "work location", "where you'll work"]
  },
  {
    type: "ABOUT_COMPANY",
    aliases: ["about us", "about company", "who we are", "company overview"]
  },
  {
    type: "ABOUT_ROLE",
    aliases: ["about the role", "position overview", "role overview"]
  },
  {
    type: "EQUAL_OPPORTUNITY",
    aliases: [
      "equal opportunity",
      "eeo statement",
      "diversity and inclusion",
      "affirmative action"
    ]
  },
  {
    type: "APPLICATION_INSTRUCTIONS",
    aliases: ["how to apply", "application instructions", "next steps"]
  }
];

function normalizeHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'+/& ]+/g, " ")
    .replace(/\s+/g, " ");
}

const aliasMap = new Map<string, SectionType>();

for (const definition of SECTION_ALIAS_DEFINITIONS) {
  for (const alias of definition.aliases) {
    aliasMap.set(normalizeHeading(alias), definition.type);
  }
}

export function detectSectionTypeFromHeading(heading: string): SectionType {
  return aliasMap.get(normalizeHeading(heading)) ?? "OTHER";
}
