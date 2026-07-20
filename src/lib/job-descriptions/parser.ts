import {
  JOB_DESCRIPTION_PARSE_CONTRACT_VERSION,
  JOB_DESCRIPTION_PARSER_VERSION,
  parsedJobDescriptionContractSchema,
  type Benefit,
  type ConfidenceLevel,
  type Compensation,
  type DetectedSection,
  type EducationRequirement,
  type ExperienceRequirement,
  type ExtractedFieldAgreement,
  type ExtractedNumericField,
  type ExtractedScalarField,
  type LevelApplicability,
  type ParserDiagnostic,
  type ParsedJobDescriptionContract,
  type QualificationRequirement,
  type Responsibility,
  type RoleMetadata,
  type SectionType,
  type SourceLocation,
  type TechnologyMention
} from "@/lib/job-descriptions/parser-contract";
import {
  detectSectionTypeFromHeading,
  resolveSectionHeading
} from "@/lib/job-descriptions/section-aliases";
import {
  JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY,
  type TechnologyDictionaryEntry
} from "@/lib/job-descriptions/technology-dictionary";

type ParseContext = {
  jobDescriptionVersionId: string;
  opportunityId: string;
  opportunityCompanyName: string;
  opportunityRoleTitle: string;
  sourceUrl: string | null;
  sourceChecksum: string;
  normalizedText: string;
  parsedAt?: Date;
  parserVersion?: string;
  contractVersion?: string;
};

export type ParsedJobDescriptionRun = {
  status: "SUCCESS" | "SUCCESS_WITH_WARNINGS" | "FAILED";
  diagnostics: ParserDiagnostic[];
  result: ParsedJobDescriptionContract | null;
};

type SegmentedLine = {
  number: number;
  text: string;
};

type Statement = {
  text: string;
  normalizedText: string;
  sourceLocation: SourceLocation;
  sourceSectionId: string;
};

type RawSection = {
  heading: string;
  canonicalHeading: string;
  type: SectionType;
  hierarchyDepth: number;
  levelApplicability: LevelApplicability;
  listOrientation: DetectedSection["listOrientation"];
  parentType: SectionType | null;
  startLine: number;
  headingLine: number;
  endLine: number;
  bodyLines: SegmentedLine[];
};

type MetadataFieldKey =
  | "companyName"
  | "roleTitle"
  | "location"
  | "workArrangement"
  | "employmentType"
  | "department"
  | "compensation"
  | "requisitionId"
  | "postedText";

type MetadataEntry = {
  key: MetadataFieldKey;
  label: string | null;
  value: string;
  rawValue: string;
  sourceLocation: SourceLocation;
};

type MetadataBlock = {
  entries: MetadataEntry[];
  headerLines: SegmentedLine[];
  consumedLineNumbers: Set<number>;
};

const headingPattern = /^[A-Z][A-Za-z0-9/&,'()\- ]{1,80}:?$/;
const bulletPattern = /^\s*(?:[-*•●◦▪‣]|\d+[.)]|[A-Za-z][.)])\s+/;
const sectionDelimiterPattern = /^\s*[:\-–—]?\s*$/;
const actionVerbPattern =
  /\b(build|design|develop|lead|improve|deliver|manage|create|own|architect|mentor|optimize|maintain|support|collaborate|drive|implement|deploy)\b/gi;
const explicitExperiencePattern =
  /\b(?:(?:at least|minimum of|minimum|over)\s+)?(\d+)(?:\s*-\s*|\s+to\s+)?(\d+)?\s*(\+)?\s+years?\b/i;
const salaryRangePattern =
  /\$?\s?(\d{2,3}(?:,\d{3})+|\d+(?:\.\d+)?)(k)?(?:\s*-\s*|\s+to\s+)\$?\s?(\d{2,3}(?:,\d{3})+|\d+(?:\.\d+)?)(k)?/i;
const hourlyPattern =
  /\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\/\s*hour|per hour|hourly)\b/i;
const annualPattern =
  /\b(per year|annually|annual(?:ly)?|salary range|base salary|\/\s*yr|\/\s*year)\b/i;
const compensationLinePattern =
  /^(?:pay range|salary range|salary|compensation)\s*:?\s*\$?\d/i;
const compensationDisclaimerPattern =
  /^(?:the actual offer may vary|actual compensation may vary|compensation may vary|pay may vary|offer may vary)/i;
const travelPattern = /\b(\d{1,2}%\s*travel|travel up to \d{1,2}%|some travel required)\b/i;
const clearancePattern = /\b(secret clearance|top secret|clearance required|public trust)\b/i;
const visaPattern =
  /\b(authorized to work|work authorization|visa sponsorship|sponsorship available|sponsorship not available)\b/i;
const degreePattern =
  /\b(bachelor'?s?|master'?s?|ph\.?d\.?|doctorate|bs|ba|ms|mba)\b[^.\n;]*/i;
const certificationPattern =
  /\b(certified|certification|aws certified|security\+|cissp|pmp|scrum master)\b[^.\n;]*/i;
const equivalentExperiencePattern =
  /\b(equivalent experience|equivalent combination of education and experience|or equivalent practical experience)\b/i;
const remotePattern = /\b(remote|work from home|distributed team)\b/i;
const hybridPattern = /\b(hybrid)\b/i;
const onsitePattern = /\b(on[- ]site|in office|office-based)\b/i;
const employmentPatterns: Array<{ value: string; pattern: RegExp }> = [
  { value: "FULL_TIME", pattern: /\b(full[- ]time)\b/i },
  { value: "PART_TIME", pattern: /\b(part[- ]time)\b/i },
  { value: "CONTRACT", pattern: /\b(contract|contractor)\b/i },
  { value: "TEMPORARY", pattern: /\b(temporary|temp)\b/i },
  { value: "INTERNSHIP", pattern: /\b(internship|intern)\b/i },
  { value: "FREELANCE", pattern: /\b(freelance)\b/i }
];
const seniorityPatterns: Array<{ value: string; pattern: RegExp }> = [
  { value: "SENIOR", pattern: /\b(senior|sr\.?)\b/i },
  { value: "STAFF", pattern: /\b(staff)\b/i },
  { value: "PRINCIPAL", pattern: /\b(principal)\b/i },
  { value: "LEAD", pattern: /\b(lead)\b/i },
  { value: "MANAGER", pattern: /\b(manager|management)\b/i },
  { value: "JUNIOR", pattern: /\b(junior|jr\.?)\b/i }
];
const headingConnectorWords = new Set([
  "a",
  "all",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "you",
  "your"
]);
const qualificationSectionTypes = new Set<SectionType>([
  "REQUIRED_QUALIFICATIONS",
  "PREFERRED_QUALIFICATIONS",
  "SKILLS",
  "TECHNICAL_CRAFT",
  "IMPACT_EXECUTION",
  "COLLABORATION_INFLUENCE",
  "CULTURE_GROWTH"
]);
const requiredQualificationSectionTypes = new Set<SectionType>([
  "REQUIRED_QUALIFICATIONS",
  "TECHNICAL_CRAFT",
  "IMPACT_EXECUTION",
  "COLLABORATION_INFLUENCE",
  "CULTURE_GROWTH"
]);
const preferredQualificationSectionTypes = new Set<SectionType>(["PREFERRED_QUALIFICATIONS"]);
const listOrientedSectionTypes = new Set<SectionType>([
  "RESPONSIBILITIES",
  "REQUIRED_QUALIFICATIONS",
  "PREFERRED_QUALIFICATIONS",
  "SKILLS",
  "TECHNICAL_CRAFT",
  "IMPACT_EXECUTION",
  "COLLABORATION_INFLUENCE",
  "CULTURE_GROWTH",
  "COMPANY_VALUES",
  "BENEFITS"
]);
const metadataLabelDefinitions: Array<{ key: MetadataFieldKey; aliases: string[] }> = [
  {
    key: "companyName",
    aliases: ["company", "organization", "employer"]
  },
  {
    key: "roleTitle",
    aliases: ["job title", "title", "role", "position"]
  },
  {
    key: "location",
    aliases: ["location", "locations", "work location", "job location"]
  },
  {
    key: "workArrangement",
    aliases: ["location type", "work arrangement", "remote status", "work type"]
  },
  {
    key: "employmentType",
    aliases: ["employment type", "job type", "schedule", "time type"]
  },
  {
    key: "department",
    aliases: ["department", "team", "function", "org"]
  },
  {
    key: "compensation",
    aliases: ["compensation", "salary", "pay range", "salary range"]
  },
  {
    key: "requisitionId",
    aliases: ["job requisition id", "requisition id", "req id"]
  },
  {
    key: "postedText",
    aliases: ["posted on", "posted"]
  }
];
const reservedAboutCompanyCandidates = new Set([
  "the job",
  "the role",
  "the team",
  "us",
  "you",
  "this role",
  "this position"
]);
const workdayWrapperNoisePatterns = [
  /^skip to main content$/i,
  /^careers home$/i,
  /^sign in$/i,
  /^home$/i,
  /^search for jobs$/i,
  /^.+ page is loaded$/i,
  /^apply$/i,
  /^save$/i,
  /^show all$/i,
  /^show match details$/i,
  /^reactivate premium$/i,
  /^read more$/i,
  /^why work here\??$/i,
  /^need assistance\??$/i,
  /^protecting your privacy$/i,
  /^follow us$/i,
  /^privacy policy$/i,
  /^responses managed off linkedin$/i,
  /^people you can reach out to$/i,
  /^school alumni from /i,
  /^get personalized tips to stand out to hirers$/i,
  /^find jobs where you.?re a top applicant/i,
  /^your profile and resume match/i,
  /^beta .* helpful\??$/i,
  /^copyright /i,
  /^workday, inc\./i
];
const workdayFooterNoisePatterns = [
  /^over \d+ people clicked apply$/i,
  /^locations?$/i,
  /^time type$/i,
  /^posted on$/i,
  /^job requisition id$/i
];

function normalizeHeadingText(value: string) {
  return value.replace(/[:\-–—]+$/, "").trim();
}

function normalizeMetadataLabel(value: string) {
  return normalizeHeadingText(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildLocation(startLine: number, endLine = startLine): SourceLocation {
  return { startLine, endLine };
}

function addDiagnostic(
  diagnostics: ParserDiagnostic[],
  code: string,
  severity: ParserDiagnostic["severity"],
  message: string,
  rule: string,
  location: SourceLocation | null = null
) {
  diagnostics.push({ code, severity, message, rule, location });
}

function makeScalarField(args: {
  value: string;
  sourceText: string;
  sourceLocation: SourceLocation;
  extractionRule: string;
  confidence: ConfidenceLevel;
  agreementWithOpportunity: ExtractedFieldAgreement;
}): ExtractedScalarField {
  return args;
}

function makeNumericField(args: {
  value: number;
  sourceText: string;
  sourceLocation: SourceLocation;
  extractionRule: string;
  confidence: ConfidenceLevel;
}): ExtractedNumericField {
  return args;
}

function buildAgreement(extractedValue: string | null, opportunityValue: string | null) {
  if (!extractedValue && opportunityValue) {
    return "MISSING_IN_SOURCE" as const;
  }

  if (extractedValue && !opportunityValue) {
    return "NO_OPPORTUNITY_VALUE" as const;
  }

  if (!extractedValue && !opportunityValue) {
    return "MISSING_IN_OPPORTUNITY" as const;
  }

  return extractedValue?.trim().toLowerCase() === opportunityValue?.trim().toLowerCase()
    ? ("MATCH" as const)
    : ("DIFFERENT" as const);
}

function segmentLines(text: string): SegmentedLine[] {
  return text.split("\n").map((line, index) => ({
    number: index + 1,
    text: line
  }));
}

function matchMetadataLabel(value: string): MetadataFieldKey | null {
  const normalized = normalizeMetadataLabel(value);

  for (const definition of metadataLabelDefinitions) {
    if (definition.aliases.some((alias) => normalizeMetadataLabel(alias) === normalized)) {
      return definition.key;
    }
  }

  return null;
}

function isWorkdayWrapperNoise(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return workdayWrapperNoisePatterns.some((pattern) => pattern.test(trimmed));
}

function isWorkdayFooterNoise(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return workdayFooterNoisePatterns.some((pattern) => pattern.test(trimmed));
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCommaAndConjunctionList(value: string) {
  return value
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchImplicitMetadataValue(value: string) {
  const trimmed = value.trim();

  if (/^remote(?:\s*\(([^)]+)\))?$/i.test(trimmed) || /^[A-Z][A-Za-z .-]+,\s?[A-Z]{2}\s+or\s+Remote/i.test(trimmed)) {
    return {
      key: "location" as const,
      value: trimmed
    };
  }

  if (employmentPatterns.some((item) => item.pattern.test(trimmed))) {
    return {
      key: "employmentType" as const,
      value: trimmed
    };
  }

  if (/^JR[A-Z0-9-]+$/i.test(trimmed)) {
    return {
      key: "requisitionId" as const,
      value: trimmed
    };
  }

  if (/^posted\s+\d+\s+(?:day|days|hour|hours|week|weeks|month|months)\s+ago$/i.test(trimmed)) {
    return {
      key: "postedText" as const,
      value: trimmed
    };
  }

  return null;
}

function isRecognizedContentHeading(value: string) {
  return (
    detectSectionTypeFromHeading(normalizeHeadingText(value)) !== "OTHER" &&
    matchMetadataLabel(value) === null
  );
}

function isLocationLike(text: string) {
  return (
    remotePattern.test(text) ||
    hybridPattern.test(text) ||
    onsitePattern.test(text) ||
    /\b[A-Z][a-z]+,\s?[A-Z]{2}\b/.test(text) ||
    /\b(united states|usa|us|bay area)\b/i.test(text)
  );
}

function isLikelyRoleLine(text: string) {
  return (
    /\b(engineer|developer|architect|manager|director|designer|scientist|analyst|specialist|lead|intern|consultant|administrator|officer|recruiter)\b/i.test(
      text
    ) || /\([^)]+\)/.test(text)
  );
}

function normalizeDepartmentValue(valueLines: SegmentedLine[]) {
  const rawValue = valueLines.map((line) => line.text.trim()).join(" | ");
  const firstValue = valueLines[0]?.text.trim() ?? "";
  const lastValue = valueLines.at(-1)?.text.trim() ?? firstValue;

  if (
    valueLines.length > 1 &&
    firstValue.toLowerCase().includes(lastValue.toLowerCase()) &&
    lastValue.length <= firstValue.length
  ) {
    return {
      value: lastValue,
      rawValue
    };
  }

  return {
    value: firstValue,
    rawValue
  };
}

function collectMetadataValueLines(lines: SegmentedLine[], startIndex: number) {
  const valueLines: SegmentedLine[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index]!;
    const trimmed = current.text.trim();

    if (!trimmed) {
      if (valueLines.length > 0) {
        break;
      }
      index += 1;
      continue;
    }

    if (
      matchMetadataLabel(trimmed) ||
      isRecognizedContentHeading(trimmed) ||
      /^([^:]+):\s+(.+)$/.test(trimmed)
    ) {
      break;
    }

    valueLines.push(current);
    index += 1;
  }

  return { valueLines, nextIndex: index };
}

function removeWorkdayWrapperNoise(
  context: ParseContext,
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
) {
  const filtered: SegmentedLine[] = [];
  const seenComparableParagraphs = new Set<string>();
  let removedNoiseCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index]!;
    const trimmed = current.text.trim();
    const nextNonEmpty = lines.slice(index + 1).find((line) => line.text.trim().length > 0)?.text.trim() ?? "";

    if (!trimmed) {
      filtered.push(current);
      continue;
    }

    if (
      isWorkdayWrapperNoise(trimmed) ||
      (trimmed === "About the job" && normalizeComparableText(nextNonEmpty).includes(normalizeComparableText(context.opportunityCompanyName))) ||
      (isWorkdayFooterNoise(trimmed) && matchMetadataLabel(trimmed) === null)
    ) {
      removedNoiseCount += 1;
      continue;
    }

    const comparable = normalizeComparableText(trimmed);
    if (
      comparable.length > 40 &&
      seenComparableParagraphs.has(comparable) &&
      comparable.includes(normalizeComparableText(context.opportunityCompanyName))
    ) {
      removedNoiseCount += 1;
      addDiagnostic(
        diagnostics,
        "DUPLICATE_COMPANY_SECTION_REMOVED",
        "INFO",
        "A duplicate company-description or footer paragraph was removed from parsing.",
        "parser.workday.duplicateCompanySection",
        buildLocation(current.number)
      );
      continue;
    }

    seenComparableParagraphs.add(comparable);
    filtered.push(current);
  }

  if (removedNoiseCount > 0) {
    addDiagnostic(
      diagnostics,
      "WORKDAY_WRAPPER_NOISE_REMOVED",
      "INFO",
      `Removed ${removedNoiseCount} Workday or wrapper-noise lines before parsing content sections.`,
      "parser.workday.noise"
    );
  }

  return filtered;
}

function extractLeadingMetadataBlock(
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
): MetadataBlock {
  const entries: MetadataEntry[] = [];
  const headerLines: SegmentedLine[] = [];
  const consumedLineNumbers = new Set<number>();
  let index = 0;

  while (index < lines.length) {
    const current = lines[index]!;
    const trimmed = current.text.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const inlineMatch = trimmed.match(/^([^:]+):\s+(.+)$/);
    const inlineKey = inlineMatch ? matchMetadataLabel(inlineMatch[1] ?? "") : null;
    if (inlineMatch && inlineKey) {
      entries.push({
        key: inlineKey,
        label: inlineMatch[1]!.trim(),
        value: inlineMatch[2]!.trim(),
        rawValue: inlineMatch[2]!.trim(),
        sourceLocation: buildLocation(current.number)
      });
      consumedLineNumbers.add(current.number);
      index += 1;
      continue;
    }

    const labelKey = matchMetadataLabel(trimmed);
    if (labelKey) {
      const { valueLines, nextIndex } = collectMetadataValueLines(lines, index + 1);
      if (valueLines.length === 0) {
        addDiagnostic(
          diagnostics,
          "METADATA_LABEL_WITHOUT_VALUE",
          "WARNING",
          `Metadata label "${trimmed}" did not have a following value line.`,
          "metadata.label.missingValue",
          buildLocation(current.number)
        );
        index += 1;
        continue;
      }

      const normalizedValue =
        labelKey === "department"
          ? normalizeDepartmentValue(valueLines)
          : {
              value: valueLines[0]!.text.trim(),
              rawValue: valueLines.map((line) => line.text.trim()).join(" | ")
            };

      entries.push({
        key: labelKey,
        label: trimmed,
        value: normalizedValue.value,
        rawValue: normalizedValue.rawValue,
        sourceLocation: buildLocation(current.number, valueLines.at(-1)!.number)
      });
      consumedLineNumbers.add(current.number);
      valueLines.forEach((line) => consumedLineNumbers.add(line.number));
      index = nextIndex;
      continue;
    }

    const implicitMetadata = matchImplicitMetadataValue(trimmed);
    if (implicitMetadata) {
      entries.push({
        key: implicitMetadata.key,
        label: null,
        value: implicitMetadata.value,
        rawValue: implicitMetadata.value,
        sourceLocation: buildLocation(current.number)
      });
      consumedLineNumbers.add(current.number);
      index += 1;
      continue;
    }

    if (isRecognizedContentHeading(trimmed)) {
      break;
    }

    if (headerLines.length < 6) {
      headerLines.push(current);
      consumedLineNumbers.add(current.number);
      index += 1;
      continue;
    }

    break;
  }

  if (entries.some((entry) => ["location", "employmentType", "requisitionId", "postedText"].includes(entry.key))) {
    addDiagnostic(
      diagnostics,
      "WORKDAY_METADATA_BLOCK_DETECTED",
      "INFO",
      "Detected Workday-style metadata values in the preamble.",
      "metadata.workday.block"
    );
  }

  return { entries, headerLines, consumedLineNumbers };
}

function isTitleStyleHeading(line: string) {
  const words = line
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .filter(Boolean);

  if (words.length === 0 || words.length > 6) {
    return false;
  }

  const scoredWords = words.filter((word) => /[A-Za-z]/.test(word));
  if (scoredWords.length === 0) {
    return false;
  }

  const titleishWords = scoredWords.filter((word) => {
    const lower = word.toLowerCase();
    return (
      headingConnectorWords.has(lower) ||
      word === word.toUpperCase() ||
      /^[A-Z]/.test(word)
    );
  });

  return titleishWords.length / scoredWords.length >= 0.75;
}

function isHeadingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (detectSectionTypeFromHeading(trimmed) !== "OTHER") {
    return true;
  }

  if (!headingPattern.test(trimmed) || bulletPattern.test(trimmed) || /[.;!?]$/.test(trimmed)) {
    return false;
  }

  const normalized = normalizeHeadingText(trimmed);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (
    /^(Experience|Ability|Working|Applying|Integrating|Implementing|Design|Build|Deliver|Lead|Drive|Collaborate|Strong|Familiarity|Writing|Sound|Open|Curious|Take)\b/.test(
      normalized
    )
  ) {
    return false;
  }

  if (trimmed.endsWith(":")) {
    return wordCount <= 8;
  }

  return wordCount <= 3 && isTitleStyleHeading(trimmed);
}

function detectSections(lines: SegmentedLine[], diagnostics: ParserDiagnostic[]): RawSection[] {
  const headingIndexes = lines.filter((line) => isHeadingLine(line.text));
  const firstRecognizedHeading = headingIndexes.find(
    (line) => detectSectionTypeFromHeading(normalizeHeadingText(line.text)) !== "OTHER"
  );

  if (headingIndexes.length === 0) {
    return [
      {
        heading: "Overview",
        canonicalHeading: "Overview",
        type: "OVERVIEW",
        hierarchyDepth: 0,
        levelApplicability: "ALL_LEVELS",
        listOrientation: "PARAGRAPH",
        parentType: null,
        startLine: 1,
        headingLine: 1,
        endLine: lines.at(-1)?.number ?? 1,
        bodyLines: lines
      }
    ];
  }

  const sections: RawSection[] = [];

  const firstHeading = firstRecognizedHeading ?? headingIndexes[0];
  if (firstHeading && firstHeading.number > 1) {
    sections.push({
      heading: "Overview",
      canonicalHeading: "Overview",
      type: "OVERVIEW",
      hierarchyDepth: 0,
      levelApplicability: "ALL_LEVELS",
      listOrientation: "PARAGRAPH",
      parentType: null,
      startLine: 1,
      headingLine: 1,
      endLine: firstHeading.number - 1,
      bodyLines: lines.filter((line) => line.number < firstHeading.number)
    });
  }

  for (let index = 0; index < headingIndexes.length; index += 1) {
    const current = headingIndexes[index];
    if (firstRecognizedHeading && current.number < firstRecognizedHeading.number) {
      continue;
    }
    const next = headingIndexes[index + 1];
    const normalizedHeading = normalizeHeadingText(current.text);
    const headingMatch = resolveSectionHeading(normalizedHeading);
    const type = headingMatch?.type ?? "OTHER";
    if (type === "OTHER") {
      addDiagnostic(
        diagnostics,
        "UNRECOGNIZED_SECTION_HEADING",
        "INFO",
        `Unrecognized section heading preserved as Other: ${normalizedHeading}`,
        "section.heading.other",
        buildLocation(current.number)
      );
    }

    sections.push({
      heading: normalizedHeading || "Other",
      canonicalHeading: headingMatch?.canonicalHeading ?? (normalizedHeading || "Other"),
      type,
      hierarchyDepth: headingMatch?.hierarchyDepth ?? 0,
      levelApplicability: headingMatch?.levelApplicability ?? "UNSPECIFIED",
      listOrientation:
        headingMatch?.listOrientation ??
        (listOrientedSectionTypes.has(type) ? "LIST" : "PARAGRAPH"),
      parentType: headingMatch?.parentType ?? null,
      startLine: current.number,
      headingLine: current.number,
      endLine: next ? next.number - 1 : (lines.at(-1)?.number ?? current.number),
      bodyLines: lines.filter(
        (line) =>
          line.number > current.number &&
          line.number <= (next ? next.number - 1 : (lines.at(-1)?.number ?? current.number))
      )
    });
  }

  return sections;
}

function toDetectedSections(sections: RawSection[]): DetectedSection[] {
  const detectedSections: DetectedSection[] = [];

  sections.forEach((section, index) => {
    const parentSectionId = section.parentType
      ? detectedSections.findLast((candidate) => candidate.type === section.parentType)?.id ?? null
      : null;

    detectedSections.push({
      id: `section-${index + 1}-${slugify(section.heading || section.type) || "section"}`,
      heading: section.heading,
      canonicalHeading: section.canonicalHeading,
      type: section.type,
      parentSectionId,
      hierarchyDepth: section.hierarchyDepth,
      levelApplicability: section.levelApplicability,
      listOrientation: section.listOrientation,
      startLine: section.startLine,
      endLine: section.endLine,
      text: section.bodyLines.map((line) => line.text).join("\n").trim(),
      confidence: section.type === "OTHER" ? "LOW" : "HIGH",
      detectionRule:
        section.type === "OVERVIEW" ? "section.preamble" : "section.heading.alias"
    });
  });

  return detectedSections;
}

function cleanStatementText(value: string) {
  return value
    .replace(bulletPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphIntoStatements(text: string): string[] {
  return [text];
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function trimTrailingPunctuation(value: string) {
  return value.trim().replace(/[.]+$/, "").trim();
}

function normalizeEquivalencyText(value: string) {
  if (/equivalent combination of education and experience/i.test(value)) {
    return "Equivalent education/experience accepted";
  }

  if (/\bor equivalent\b/i.test(value)) {
    return "Or equivalent accepted";
  }

  if (/equivalent experience/i.test(value)) {
    return "Equivalent experience accepted";
  }

  return trimTrailingPunctuation(value);
}

function extractDegreeClause(text: string) {
  const degreeMatch = text.match(degreePattern)?.[0] ?? null;
  if (!degreeMatch) {
    return null;
  }

  return trimTrailingPunctuation(
    degreeMatch
      .replace(/\s+and\s+\d+\+?\s+years?.*$/i, "")
      .replace(/\s+or\s+equivalent.*$/i, "")
  );
}

function extractExperienceClause(text: string) {
  const experienceMatch = text.match(
    /\b\d+\+?\s+years?\s+of\s+[^.]+?experience(?=\s+(?:or\s+equivalent(?:\s+combination\s+of\s+education\s+and\s+experience|\s+experience)?|$|[.]))/i
  );

  return experienceMatch ? trimTrailingPunctuation(experienceMatch[0]) : null;
}

function extractCertificationClause(text: string) {
  const certificationMatch = text.match(certificationPattern)?.[0] ?? null;
  if (!certificationMatch) {
    return null;
  }

  return trimTrailingPunctuation(certificationMatch);
}

function isCompensationRequirementLeak(text: string) {
  const trimmed = text.trim();
  return (
    compensationLinePattern.test(trimmed) ||
    compensationDisclaimerPattern.test(trimmed) ||
    (/geographic location/i.test(trimmed) &&
      /years of experience/i.test(trimmed) &&
      /\b(?:offer|compensation|salary|pay)\b/i.test(trimmed))
  );
}

function buildSourceGroupId(section: DetectedSection, sourceLocation: SourceLocation, text: string) {
  return `group-${section.startLine}-${sourceLocation.startLine}-${slugify(text) || "item"}`;
}

function extractEquivalencyText(sourceText: string, expandedText: string) {
  const certificationEquivalentMatch = sourceText.match(/\bor equivalent\b/i);
  const educationEquivalentMatch = sourceText.match(equivalentExperiencePattern);

  if (
    (degreePattern.test(expandedText) || explicitExperiencePattern.test(expandedText)) &&
    educationEquivalentMatch
  ) {
    return normalizeEquivalencyText(educationEquivalentMatch[0]);
  }

  if (certificationPattern.test(expandedText) && certificationEquivalentMatch) {
    return normalizeEquivalencyText(certificationEquivalentMatch[0]);
  }

  return null;
}

function expandQualificationStatementText(section: DetectedSection, text: string) {
  const trimmed = text.trim();

  if (
    section.type === "RESPONSIBILITIES" ||
    section.type === "BENEFITS" ||
    section.type === "COMPANY_VALUES"
  ) {
    return [trimmed];
  }

  if (/following technologies:/i.test(trimmed)) {
    const [beforeList, afterList = ""] = trimmed.split(/following technologies:/i);
    const items: string[] = [];
    const normalizedBeforeList = beforeList
      .replace(/\s+in the\s*$/i, "")
      .trim()
      .replace(/[.:]$/, "");

    if (normalizedBeforeList) {
      items.push(...expandQualificationStatementText(section, normalizedBeforeList));
    }

    items.push(...splitCommaAndConjunctionList(afterList.replace(/[.]+$/, "")));
    return items.filter(Boolean);
  }

  if (
    section.type === "PREFERRED_QUALIFICATIONS" &&
    /^familiarity with\b/i.test(trimmed) &&
    /\(([^)]+)\)/.test(trimmed)
  ) {
    const sentences = splitIntoSentences(trimmed);
    const toolingSentence = sentences[0] ?? trimmed;
    const trailingSentences = sentences.slice(1).map((sentence) => trimTrailingPunctuation(sentence));
    const toolList = trimmed.match(/\(([^)]+)\)/)?.[1] ?? "";
    const tools = splitCommaAndConjunctionList(toolList);

    if (tools.length >= 2) {
      return [
        ...tools.map((tool) => `Familiarity with ${tool}`),
        ...trailingSentences
      ];
    }
  }

  if (
    section.type === "REQUIRED_QUALIFICATIONS" &&
    degreePattern.test(trimmed) &&
    explicitExperiencePattern.test(trimmed)
  ) {
    const sentences = splitIntoSentences(trimmed);
    const primarySentence = sentences[0] ?? trimmed;
    const trailingSentences = sentences.slice(1);
    const degreeClause = extractDegreeClause(primarySentence);
    const experienceClause = extractExperienceClause(primarySentence);

    return [
      degreeClause ?? "",
      experienceClause ?? "",
      ...trailingSentences.map((sentence) => trimTrailingPunctuation(sentence))
    ].filter(Boolean);
  }

  if (
    (section.type === "REQUIRED_QUALIFICATIONS" ||
      section.type === "PREFERRED_QUALIFICATIONS" ||
      section.type === "ABOUT_ROLE") &&
    (section.listOrientation === "PARAGRAPH" || /[.!?]\s+[A-Z]/.test(trimmed))
  ) {
    const sentences = splitIntoSentences(trimmed);
    if (sentences.length > 1) {
      return sentences.map((sentence) => trimTrailingPunctuation(sentence));
    }
  }

  return [trimmed];
}

function startsWithLowercaseWord(text: string) {
  return /^[a-z]/.test(text.trim());
}

function endsWithContinuationSignal(text: string) {
  return /(?:[,:(]|\b(?:and|or)\b)\s*$/i.test(text.trim());
}

function beginsIndependentListItem(text: string) {
  return /^(?:[A-Z][a-z]+ing\b|[A-Z][a-z]+s?\b|Strong\b|Familiarity\b|Sound\b|Ability\b|Clear\b|Open\b|Curious\b|Take\b|Working\b|Applying\b|Integrating\b|Implementing\b|Experience\b|Shaping\b|Architecting\b|Design\b|Collaborate\b|Balance\b|Continuously\b|Contribute\b|Lead\b|Drive\b|Set\b|Partner\b|Serve\b|Represent\b|Empathy\b|Mentors\b|Works\b)/.test(
    text.trim()
  );
}

function lacksIndependentPredicate(text: string) {
  return !/\b(is|are|be|build|design|deliver|collaborate|balance|improve|contribute|write|writing|work|works|lead|drive|set|partner|serve|represent|apply|integrate|implement|take|mentor|scope|prioritize|shape|communicat|embodies)\b/i.test(
    text
  );
}

function shouldTreatLineAsContinuation(previous: SegmentedLine, current: SegmentedLine) {
  const previousText = cleanStatementText(previous.text);
  const currentText = cleanStatementText(current.text);

  if (!previousText || !currentText) {
    return false;
  }

  if (bulletPattern.test(current.text)) {
    return false;
  }

  if (endsWithContinuationSignal(previousText)) {
    return true;
  }

  if (startsWithLowercaseWord(currentText)) {
    return true;
  }

  if (/^\s{2,}\S/.test(current.text) && lacksIndependentPredicate(currentText)) {
    return true;
  }

  if (!beginsIndependentListItem(currentText) && lacksIndependentPredicate(currentText)) {
    return true;
  }

  return false;
}

function segmentStatements(section: DetectedSection, lines: SegmentedLine[]): Statement[] {
  const bodyLines = lines.filter(
    (line) => line.number > section.startLine && line.number <= section.endLine
  );
  const statements: Statement[] = [];
  let current: SegmentedLine[] = [];

  const flushCurrent = () => {
    if (current.length === 0) {
      return;
    }

    const joined = current.map((line) => cleanStatementText(line.text)).join(" ").trim();
    if (!joined) {
      current = [];
      return;
    }

    const location = buildLocation(current[0]!.number, current.at(-1)!.number);
    for (const part of splitParagraphIntoStatements(joined)) {
      statements.push({
        text: part,
        normalizedText: part.toLowerCase(),
        sourceLocation: location,
        sourceSectionId: section.id
      });
    }

    current = [];
  };

  for (const line of bodyLines) {
    const trimmed = line.text.trim();
    if (!trimmed || sectionDelimiterPattern.test(trimmed)) {
      flushCurrent();
      continue;
    }

    if (bulletPattern.test(line.text)) {
      flushCurrent();
      current = [line];
      continue;
    }

    if (
      section.listOrientation === "LIST" &&
      current.length > 0 &&
      !shouldTreatLineAsContinuation(current.at(-1)!, line)
    ) {
      flushCurrent();
      current = [line];
      continue;
    }

    current.push(line);
  }

  flushCurrent();
  return statements;
}

function extractActionVerbs(text: string) {
  const matches = text.match(actionVerbPattern);
  return Array.from(new Set(matches?.map((match) => match.toLowerCase()) ?? []));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCaseSensitiveAlias(alias: string) {
  return /^[A-Za-z]{1,2}$/.test(alias);
}

function buildTechnologyAliasPattern(alias: string) {
  return `(?<![A-Za-z0-9])${escapeRegExp(alias)}(?![A-Za-z0-9])`;
}

function findTechnologyMentionsInText(
  text: string,
  dictionary: TechnologyDictionaryEntry[]
) {
  const matches: Array<{ entry: TechnologyDictionaryEntry; alias: string }> = [];

  for (const entry of dictionary) {
    for (const alias of entry.aliases) {
      const pattern = new RegExp(
        buildTechnologyAliasPattern(alias),
        isCaseSensitiveAlias(alias) ? "" : "i"
      );
      if (pattern.test(text)) {
        matches.push({ entry, alias });
        break;
      }
    }
  }

  return matches;
}

function extractResponsibilities(
  sections: DetectedSection[],
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
): Responsibility[] {
  const responsibilities: Responsibility[] = [];

  for (const section of sections.filter((item) => item.type === "RESPONSIBILITIES")) {
    const statements = segmentStatements(section, lines);
    const labeledStatements = statements.filter((statement) =>
      /^[A-Z][A-Za-z0-9/&,'()\- ]{1,40}:\s+.+/.test(statement.text)
    );
    if (labeledStatements.length >= 2) {
      addDiagnostic(
        diagnostics,
        "LABELED_RESPONSIBILITIES_DETECTED",
        "INFO",
        `Detected ${labeledStatements.length} labeled responsibility statements.`,
        "responsibilities.labeled.detected",
        buildLocation(section.startLine, section.endLine)
      );
    }
    statements.forEach((statement, index) => {
      const technologyMentions = findTechnologyMentionsInText(
        statement.text,
        JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY
      ).map((match) => match.entry.canonicalName);

      responsibilities.push({
        id: `responsibility-${section.startLine}-${index + 1}-${slugify(statement.text) || "item"}`,
        text: statement.text,
        normalizedText: statement.normalizedText,
        sourceSectionId: section.id,
        sourceLocation: statement.sourceLocation,
        actionVerbs: extractActionVerbs(statement.text),
        technologyMentions,
        confidence: "HIGH"
      });
    });
  }

  return responsibilities;
}

function extractExperienceRequirement(
  statementId: string,
  text: string,
  sourceLocation: SourceLocation,
  associatedSkill: string | null
): ExperienceRequirement | null {
  const match = text.match(explicitExperiencePattern);
  if (!match) {
    return null;
  }

  const minimumYears = Number(match[1]);
  const maximumYears = match[2] ? Number(match[2]) : null;

  return {
    id: `experience-${statementId}`,
    minimumYears,
    maximumYears,
    plusIndicator: Boolean(match[3]),
    associatedSkill,
    sourceStatementId: statementId,
    originalText: text,
    confidence: associatedSkill ? "HIGH" : "MEDIUM"
  };
}

function detectExperienceDomain(text: string) {
  if (/\bsoftware development\b/i.test(text)) {
    return "software development";
  }

  if (/\bagile scrum\b/i.test(text)) {
    return "Agile Scrum";
  }

  return null;
}

function detectRequirementLabel(sectionType: SectionType, text: string) {
  if (
    requiredQualificationSectionTypes.has(sectionType) ||
    sectionType === "SKILLS"
  ) {
    if (/\bminimum\b/i.test(text)) {
      return "MINIMUM" as const;
    }

    return "REQUIRED" as const;
  }

  if (preferredQualificationSectionTypes.has(sectionType)) {
    if (/\bbonus\b/i.test(text)) {
      return "BONUS" as const;
    }

    if (/\bnice to have\b/i.test(text)) {
      return "NICE_TO_HAVE" as const;
    }

    return "PREFERRED" as const;
  }

  if (/\bbonus\b/i.test(text)) {
    return "BONUS" as const;
  }

  if (/\bnice to have\b/i.test(text)) {
    return "NICE_TO_HAVE" as const;
  }

  return "UNSPECIFIED" as const;
}

function detectStatementLevelApplicability(
  section: DetectedSection,
  text: string
): LevelApplicability {
  if (/take increasing ownership\b/i.test(text)) {
    return "CONDITIONAL_HIGHER_LEVEL";
  }

  if (section.levelApplicability !== "UNSPECIFIED") {
    return section.levelApplicability;
  }

  if (/\bat the staff level\b/i.test(section.heading)) {
    return "STAFF_ONLY";
  }

  if (/\bat the senior level\b/i.test(section.heading)) {
    return "SENIOR_ONLY";
  }

  return "ALL_LEVELS";
}

function buildQualificationRequirement(args: {
  confidence: ConfidenceLevel;
  explicitLabel: ReturnType<typeof detectRequirementLabel>;
  extractionRule: string;
  experienceRequirementId: string | null;
  leadershipReferences: string[];
  section: DetectedSection;
  sourceLocation: SourceLocation;
  sourceGroupId: string | null;
  statementId: string;
  technologyReferences: string[];
  text: string;
  domainReferences: string[];
  degreeRequirement: string | null;
  certificationRequirement: string | null;
  equivalencyText: string | null;
}): QualificationRequirement {
  return {
    id: args.statementId,
    originalText: args.text,
    normalizedText: args.text.toLowerCase(),
    sourceSectionId: args.section.id,
    sourceLocation: args.sourceLocation,
    sourceGroupId: args.sourceGroupId,
    explicitLabel: args.explicitLabel,
    levelApplicability: detectStatementLevelApplicability(args.section, args.text),
    experienceRequirementId: args.experienceRequirementId,
    degreeRequirement: args.degreeRequirement,
    certificationRequirement: args.certificationRequirement,
    equivalencyText: args.equivalencyText,
    technologyReferences: args.technologyReferences,
    domainReferences: args.domainReferences,
    leadershipReferences: args.leadershipReferences,
    confidence: args.confidence,
    extractionRule: args.extractionRule
  };
}

function extractContextualSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .flatMap((sentence) => sentence.split(/\s*;\s*/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function isUsefulAboutRoleContext(text: string) {
  const trimmed = text.trim();

  return (
    /\b[A-Z][A-Za-z]+(?:\s+(?:and\s+)?[A-Z][A-Za-z]+){1,3}\s+team\b/.test(trimmed) ||
    /\bacross\s+web\s+and\s+mobile\s+platforms?\b/i.test(trimmed) ||
    /\b(?:healthcare|primary care|value-based care|audit|assurance|risk management|compliance|payments|fintech|government|gov)\b/i.test(
      trimmed
    ) ||
    /\b(?:small to medium|small-to-medium)\s+complexity\b/i.test(trimmed) ||
    /\boperate with autonomy\b|\bautonomous(?:ly)?\b|\bwell-established organizational development practices\b/i.test(
      trimmed
    ) ||
    /\bremote\b|\bhybrid\b/i.test(trimmed)
  );
}

function buildContextualItemsFromSections(sections: DetectedSection[]) {
  const contextualItems: Array<{
    section: DetectedSection;
    text: string;
    sourceLocation: SourceLocation;
  }> = [];

  for (const section of sections) {
    const sentences = extractContextualSentences(section.text);

    if (section.type === "ABOUT_ROLE" || section.type === "LOCATION") {
      sentences.forEach((sentence, index) => {
        const sentenceParts =
          section.type === "ABOUT_ROLE"
            ? sentence
                .split(/\s+(?=who can\b|while\b|demonstrating\b)/i)
                .map((part) => trimTrailingPunctuation(part))
                .filter(Boolean)
            : [sentence];

        sentenceParts.forEach((part, partIndex) => {
          if (
            (section.type === "ABOUT_ROLE" && isUsefulAboutRoleContext(part)) ||
            /\bremote candidates anywhere in the us\b/i.test(part) ||
            /\bhybrid setting\b/i.test(part) ||
            /\bacross multiple levels\b/i.test(part) ||
            /\bfinal level will be determined during the interview process\b/i.test(part)
          ) {
            contextualItems.push({
              section,
              text: part,
              sourceLocation: buildLocation(
                section.startLine + 1 + index + partIndex,
                section.startLine + 1 + index + partIndex
              )
            });
          }
        });
      });
    }

    if (section.type === "COMPANY_VALUES") {
      section.text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line, index) => {
          contextualItems.push({
            section,
            text: line,
            sourceLocation: buildLocation(section.startLine + 2 + index, section.startLine + 2 + index)
          });
        });
    }
  }

  return contextualItems;
}

function extractQualificationsAndExperience(
  sections: DetectedSection[],
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
) {
  const qualifications: QualificationRequirement[] = [];
  const experienceRequirements: ExperienceRequirement[] = [];

  for (const section of sections.filter((item) => qualificationSectionTypes.has(item.type))) {
    const statements = segmentStatements(section, lines);
    const atomicStatements = statements.flatMap((statement) =>
      {
        const expandedStatements = expandQualificationStatementText(section, statement.text);
        const sourceGroupId =
          expandedStatements.length > 1
            ? buildSourceGroupId(section, statement.sourceLocation, statement.text)
            : null;

        if (
          expandedStatements.length > 1 &&
          section.type === "REQUIRED_QUALIFICATIONS" &&
          degreePattern.test(statement.text) &&
          explicitExperiencePattern.test(statement.text)
        ) {
          addDiagnostic(
            diagnostics,
            "COMPOUND_EDUCATION_EXPERIENCE_DECOMPOSED",
            "INFO",
            `Decomposed a compound education and experience requirement: ${statement.text}`,
            "requirements.decomposition.educationExperience",
            statement.sourceLocation
          );
        }

        if (
          expandedStatements.length > 1 &&
          section.type === "PREFERRED_QUALIFICATIONS" &&
          certificationPattern.test(statement.text)
        ) {
          addDiagnostic(
            diagnostics,
            "CERTIFICATION_TOOLING_ITEMS_DECOMPOSED",
            "INFO",
            `Separated tooling and certification expectations into atomic preferred items: ${statement.text}`,
            "requirements.decomposition.toolingCertification",
            statement.sourceLocation
          );
        }

        return expandedStatements.map((expandedText, expandedIndex) => ({
          text: expandedText,
          sourceLocation: statement.sourceLocation,
          sourceSectionId: statement.sourceSectionId,
          normalizedText: expandedText.toLowerCase(),
          ordinal: expandedIndex,
          sourceGroupId,
          equivalencyText: extractEquivalencyText(statement.text, expandedText)
        }));
      }
    );
    statements.forEach((statement, index) => {
      if (
        section.type === "REQUIRED_QUALIFICATIONS" &&
        section.listOrientation === "PARAGRAPH" &&
        expandQualificationStatementText(section, statement.text).length <= 1
      ) {
        addDiagnostic(
          diagnostics,
          "QUALIFICATIONS_SECTION_UNDER_EXTRACTED",
          "INFO",
          `Paragraph qualifications remained a single statement: ${statement.text}`,
          "requirements.section.paragraph"
        );
      }
      if (
        section.type === "PREFERRED_QUALIFICATIONS" &&
        section.listOrientation === "PARAGRAPH" &&
        expandQualificationStatementText(section, statement.text).length <= 1
      ) {
        addDiagnostic(
          diagnostics,
          "DESIRED_ATTRIBUTES_SECTION_UNDER_EXTRACTED",
          "INFO",
          `Preferred paragraph attributes remained a single statement: ${statement.text}`,
          "requirements.section.paragraph.preferred"
        );
      }
    });

    atomicStatements.forEach((statement, index) => {
      if (isCompensationRequirementLeak(statement.text)) {
        addDiagnostic(
          diagnostics,
          "COMPENSATION_EXCLUDED_FROM_REQUIREMENTS",
          "INFO",
          `Excluded compensation or offer-disclaimer text from requirement extraction: ${statement.text}`,
          "requirements.compensation.excluded",
          statement.sourceLocation
        );
        return;
      }

      const statementId = `requirement-${section.startLine}-${index + 1}-${slugify(statement.text) || "item"}`;
      const technologyMatches = findTechnologyMentionsInText(
        statement.text,
        JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY
      );
      const technologyReferences = technologyMatches.map((match) => match.entry.canonicalName);
      const domainReferences = /\b(fintech|healthcare|ai|machine learning|payments|saas|security)\b/gi.test(
        statement.text
      )
        ? Array.from(
            new Set(
              (statement.text.match(
                /\b(fintech|healthcare|ai|machine learning|payments|saas|security)\b/gi
              ) ?? []).map((value) => value.toLowerCase())
            )
          )
        : [];
      const leadershipReferences = /\b(lead|mentor|manage|stakeholder|cross-functional)\b/gi.test(
        statement.text
      )
        ? Array.from(
            new Set(
              (statement.text.match(
                /\b(lead|mentor|manage|stakeholder|cross-functional)\b/gi
              ) ?? []).map((value) => value.toLowerCase())
            )
          )
        : [];
      const experienceRequirement = extractExperienceRequirement(
        statementId,
        statement.text,
        statement.sourceLocation,
        technologyReferences[0] ?? detectExperienceDomain(statement.text)
      );

      if (experienceRequirement && !experienceRequirement.associatedSkill) {
        addDiagnostic(
          diagnostics,
          "EXPERIENCE_WITHOUT_CLEAR_SKILL",
          "WARNING",
          `Experience years were detected without a clear associated skill: ${statement.text}`,
          "requirements.experience.ambiguous",
          statement.sourceLocation
        );
      }

      if (experienceRequirement) {
        experienceRequirements.push(experienceRequirement);
        addDiagnostic(
          diagnostics,
          "EXPERIENCE_REQUIREMENT_EXTRACTED",
          "INFO",
          `Extracted explicit experience requirement: ${statement.text}`,
          "requirements.experience.extracted",
          statement.sourceLocation
        );
      }

      if (equivalentExperiencePattern.test(statement.text)) {
        addDiagnostic(
          diagnostics,
          "EDUCATION_EQUIVALENCY_DETECTED",
          "INFO",
          `Detected education equivalency language: ${statement.text}`,
          "requirements.education.equivalency",
          statement.sourceLocation
        );
      }

      const degreeRequirementMatch = statement.text.match(degreePattern)?.[0] ?? null;
      const certificationRequirementMatch = extractCertificationClause(statement.text);
      const label = detectRequirementLabel(section.type, statement.text);
      if (label === "UNSPECIFIED") {
        addDiagnostic(
          diagnostics,
          "REQUIREMENT_WITHOUT_EXPLICIT_CATEGORY",
          "INFO",
          `Requirement did not have an explicit required or preferred label: ${statement.text}`,
          "requirements.label.unspecified",
          statement.sourceLocation
        );
      }

      qualifications.push(
        buildQualificationRequirement({
          statementId,
          text: statement.text,
          sourceLocation: statement.sourceLocation,
          section,
          explicitLabel: label,
          experienceRequirementId: experienceRequirement?.id ?? null,
          sourceGroupId: statement.sourceGroupId,
          degreeRequirement: degreeRequirementMatch,
          certificationRequirement: certificationRequirementMatch,
          equivalencyText: statement.equivalencyText,
          technologyReferences,
          domainReferences,
          leadershipReferences,
          confidence: section.type === "SKILLS" ? "MEDIUM" : "HIGH",
          extractionRule: "requirements.statement.segmented"
        })
      );
    });
  }

  buildContextualItemsFromSections(sections).forEach((item, index) => {
    qualifications.push(
      buildQualificationRequirement({
        statementId: `contextual-${item.section.startLine}-${index + 1}-${slugify(item.text) || "item"}`,
        text: item.text,
        sourceLocation: item.sourceLocation,
        section: item.section,
        explicitLabel: "UNSPECIFIED",
        experienceRequirementId: null,
        sourceGroupId: null,
        degreeRequirement: null,
        certificationRequirement: null,
        equivalencyText: null,
        technologyReferences: findTechnologyMentionsInText(
          item.text,
          JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY
        ).map((match) => match.entry.canonicalName),
        domainReferences: [],
        leadershipReferences: [],
        confidence: "HIGH",
        extractionRule: "requirements.contextual.section"
      })
    );
  });

  return { qualifications, experienceRequirements };
}

function collectTechnologyMentions(
  responsibilities: Responsibility[],
  qualifications: QualificationRequirement[]
): TechnologyMention[] {
  const mentionMap = new Map<string, TechnologyMention>();

  for (const responsibility of responsibilities) {
    for (const match of findTechnologyMentionsInText(
      responsibility.text,
      JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY
    )) {
      const key = match.entry.canonicalName;
      const existing = mentionMap.get(key);
      if (existing) {
        existing.mentionCount += 1;
        existing.sourceResponsibilityIds.push(responsibility.id);
        continue;
      }

      mentionMap.set(key, {
        id: `technology-${slugify(match.entry.canonicalName)}`,
        canonicalName: match.entry.canonicalName,
        originalText: match.alias,
        category: match.entry.category,
        sourceRequirementIds: [],
        sourceResponsibilityIds: [responsibility.id],
        mentionCount: 1,
        firstSourceLocation: responsibility.sourceLocation,
        aliasMatch: match.alias.toLowerCase() !== match.entry.canonicalName.toLowerCase(),
        confidence: match.alias.toLowerCase() === match.entry.canonicalName.toLowerCase()
          ? "HIGH"
          : "MEDIUM"
      });
    }
  }

  for (const qualification of qualifications) {
    for (const match of findTechnologyMentionsInText(
      qualification.originalText,
      JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY
    )) {
      const key = match.entry.canonicalName;
      const existing = mentionMap.get(key);
      if (existing) {
        existing.mentionCount += 1;
        existing.sourceRequirementIds.push(qualification.id);
        continue;
      }

      mentionMap.set(key, {
        id: `technology-${slugify(match.entry.canonicalName)}`,
        canonicalName: match.entry.canonicalName,
        originalText: match.alias,
        category: match.entry.category,
        sourceRequirementIds: [qualification.id],
        sourceResponsibilityIds: [],
        mentionCount: 1,
        firstSourceLocation: qualification.sourceLocation,
        aliasMatch: match.alias.toLowerCase() !== match.entry.canonicalName.toLowerCase(),
        confidence: match.alias.toLowerCase() === match.entry.canonicalName.toLowerCase()
          ? "HIGH"
          : "MEDIUM"
      });
    }
  }

  return Array.from(mentionMap.values()).sort((left, right) =>
    left.canonicalName.localeCompare(right.canonicalName)
  );
}

function findMetadataEntry(metadataBlock: MetadataBlock, key: MetadataFieldKey) {
  return metadataBlock.entries.find((entry) => entry.key === key) ?? null;
}

function normalizeCountryRegion(value: string) {
  const trimmed = value.trim();

  if (/^(usa|us|united states)$/i.test(trimmed)) {
    return "United States";
  }

  return trimmed;
}

function parseCompensationNumber(value: string, suffix: string | undefined) {
  const numericValue = Number(value.replace(/,/g, ""));
  return suffix?.toLowerCase() === "k" ? numericValue * 1000 : numericValue;
}

function normalizeLocationMetadata(value: string) {
  const trimmed = value.trim();
  const remoteSuffixMatch = trimmed.match(/^(.*?)\s+or\s+remote\s*\(([^)]+)\)$/i);
  if (remoteSuffixMatch) {
    return {
      primaryLocation: `Remote, ${normalizeCountryRegion(remoteSuffixMatch[2]!)}`,
      secondaryLocation: remoteSuffixMatch[1]!.trim(),
      rawLocation: trimmed
    };
  }

  const remoteOnlyMatch = trimmed.match(/^remote(?:\s*\(([^)]+)\))?$/i);
  if (remoteOnlyMatch) {
    return {
      primaryLocation: remoteOnlyMatch[1]
        ? `Remote, ${normalizeCountryRegion(remoteOnlyMatch[1])}`
        : "Remote",
      secondaryLocation: null,
      rawLocation: trimmed
    };
  }

  return {
    primaryLocation: trimmed,
    secondaryLocation: null,
    rawLocation: trimmed
  };
}

function extractCompanyFromAboutHeading(
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
) {
  for (const line of lines) {
    const match = line.text.trim().match(/^About\s+(.+)$/i);
    if (!match) {
      continue;
    }

    const candidate = normalizeComparableText(match[1]!.trim());
    if (reservedAboutCompanyCandidates.has(candidate)) {
      addDiagnostic(
        diagnostics,
        "RESERVED_ABOUT_HEADING_NOT_COMPANY",
        "INFO",
        `Reserved About heading "${line.text.trim()}" was not used as a company candidate.`,
        "metadata.company.aboutReserved",
        buildLocation(line.number)
      );
      continue;
    }

    return {
      value: match[1]!.trim(),
      sourceText: line.text.trim(),
      sourceLocation: buildLocation(line.number),
      extractionRule: "metadata.company.aboutHeading" as const,
      confidence: "HIGH" as const
    };
  }

  return null;
}

function extractCompensation(
  sections: DetectedSection[],
  lines: SegmentedLine[],
  metadataBlock: MetadataBlock,
  diagnostics: ParserDiagnostic[]
): Compensation {
  const compensationLines = lines.filter(
    (line) =>
      sections.some((section) => section.type === "COMPENSATION" && line.number >= section.startLine && line.number <= section.endLine) ||
      /\b(salary|compensation|pay range|\$\d)/i.test(line.text)
  );
  const metadataCompensation = findMetadataEntry(metadataBlock, "compensation");
  const compensationTexts = compensationLines.map((line) => line.text.trim());
  if (metadataCompensation) {
    compensationTexts.push(metadataCompensation.rawValue);
  }
  const combinedText = Array.from(new Set(compensationTexts.filter(Boolean))).join(" ");

  let minimumSalary: ExtractedNumericField | null = null;
  let maximumSalary: ExtractedNumericField | null = null;
  let currency: ExtractedScalarField | null = null;
  let payPeriod: ExtractedScalarField | null = null;
  let compensationType: ExtractedScalarField | null = null;
  const salaryMatch = combinedText.match(salaryRangePattern);
  const hourlyMatch = combinedText.match(hourlyPattern);

  if (salaryMatch) {
    const location = buildLocation(
      compensationLines[0]?.number ?? 1,
      compensationLines.at(-1)?.number ?? compensationLines[0]?.number ?? 1
    );
    minimumSalary = makeNumericField({
      value: parseCompensationNumber(salaryMatch[1]!, salaryMatch[2]),
      sourceText: salaryMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.salary.range",
      confidence: "HIGH"
    });
    maximumSalary = makeNumericField({
      value: parseCompensationNumber(salaryMatch[3]!, salaryMatch[4]),
      sourceText: salaryMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.salary.range",
      confidence: "HIGH"
    });
    currency = makeScalarField({
      value: "USD",
      sourceText: salaryMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.currency.dollar",
      confidence: "MEDIUM",
      agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
    });
    payPeriod = annualPattern.test(combinedText)
      ? makeScalarField({
          value: "YEAR",
          sourceText: combinedText,
          sourceLocation: location,
          extractionRule: "compensation.period.annual",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null;
    compensationType = makeScalarField({
      value: "SALARIED",
      sourceText: salaryMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.type.salary",
      confidence: "MEDIUM",
      agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
    });
  } else if (hourlyMatch) {
    const location = buildLocation(
      compensationLines[0]?.number ?? 1,
      compensationLines.at(-1)?.number ?? compensationLines[0]?.number ?? 1
    );
    minimumSalary = makeNumericField({
      value: Number(hourlyMatch[1]!.replace(/,/g, "")),
      sourceText: hourlyMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.hourly.rate",
      confidence: "HIGH"
    });
    currency = makeScalarField({
      value: "USD",
      sourceText: hourlyMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.currency.dollar",
      confidence: "MEDIUM",
      agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
    });
    payPeriod = makeScalarField({
      value: "HOUR",
      sourceText: hourlyMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.period.hourly",
      confidence: "HIGH",
      agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
    });
    compensationType = makeScalarField({
      value: "HOURLY",
      sourceText: hourlyMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.type.hourly",
      confidence: "HIGH",
      agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
    });
  }

  const salaryMatches = combinedText.match(new RegExp(salaryRangePattern.source, "gi")) ?? [];
  if (salaryMatches.length > 1) {
    addDiagnostic(
      diagnostics,
      "MULTIPLE_SALARY_RANGES_DETECTED",
      "WARNING",
      "Multiple salary ranges were detected in the description.",
      "compensation.salary.multiple"
    );
  }

  return {
    minimumSalary,
    maximumSalary,
    currency,
    payPeriod,
    compensationText: combinedText || null,
    bonus: /\bbonus\b/i.test(combinedText)
      ? makeScalarField({
          value: "BONUS",
          sourceText: combinedText,
          sourceLocation: buildLocation(
            compensationLines[0]?.number ?? 1,
            compensationLines.at(-1)?.number ?? compensationLines[0]?.number ?? 1
          ),
          extractionRule: "compensation.bonus.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    equity: /\bequity|stock\b/i.test(combinedText)
      ? makeScalarField({
          value: "EQUITY",
          sourceText: combinedText,
          sourceLocation: buildLocation(
            compensationLines[0]?.number ?? 1,
            compensationLines.at(-1)?.number ?? compensationLines[0]?.number ?? 1
          ),
          extractionRule: "compensation.equity.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    commission: /\bcommission\b/i.test(combinedText)
      ? makeScalarField({
          value: "COMMISSION",
          sourceText: combinedText,
          sourceLocation: buildLocation(
            compensationLines[0]?.number ?? 1,
            compensationLines.at(-1)?.number ?? compensationLines[0]?.number ?? 1
          ),
          extractionRule: "compensation.commission.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    compensationType,
    locationDependentRange: /\bdepending on location|based on location\b/i.test(combinedText)
  };
}

function extractRoleMetadata(
  context: ParseContext,
  lines: SegmentedLine[],
  metadataBlock: MetadataBlock,
  diagnostics: ParserDiagnostic[]
): RoleMetadata {
  const combinedText = lines.map((line) => line.text).join("\n");
  const explicitCompany = findMetadataEntry(metadataBlock, "companyName");
  const explicitRole = findMetadataEntry(metadataBlock, "roleTitle");
  const explicitLocation = findMetadataEntry(metadataBlock, "location");
  const explicitWorkArrangement = findMetadataEntry(metadataBlock, "workArrangement");
  const explicitEmploymentType = findMetadataEntry(metadataBlock, "employmentType");
  const explicitDepartment = findMetadataEntry(metadataBlock, "department");
  const explicitRequisitionId = findMetadataEntry(metadataBlock, "requisitionId");
  const explicitPostedText = findMetadataEntry(metadataBlock, "postedText");
  const aboutHeadingCompany = extractCompanyFromAboutHeading(lines, diagnostics);
  const normalizedOpportunityCompany = context.opportunityCompanyName.trim().toLowerCase();
  const normalizedOpportunityRole = context.opportunityRoleTitle.trim().toLowerCase();
  const nonLocationHeaderLines = metadataBlock.headerLines.filter(
    (line) => !isLocationLike(line.text)
  );
  const matchingCompanyHeader =
    nonLocationHeaderLines.find(
      (line) => line.text.trim().toLowerCase() === normalizedOpportunityCompany
    ) ?? null;
  const matchingRoleHeader =
    nonLocationHeaderLines.find(
      (line) => line.text.trim().toLowerCase() === normalizedOpportunityRole
    ) ?? null;
  const roleHeaderLine =
    matchingRoleHeader ??
    nonLocationHeaderLines.find((line) => isLikelyRoleLine(line.text)) ??
    nonLocationHeaderLines.find((line) => line.number !== matchingCompanyHeader?.number) ??
    nonLocationHeaderLines[0] ??
    null;
  const companyHeaderLine =
    matchingCompanyHeader ??
    nonLocationHeaderLines.find(
      (line) =>
        line.number !== roleHeaderLine?.number &&
        !isLikelyRoleLine(line.text)
    ) ??
    nonLocationHeaderLines.find((line) => line.number !== roleHeaderLine?.number) ??
    null;

  const companyName = explicitCompany
    ? makeScalarField({
        value: explicitCompany.value,
        sourceText: explicitCompany.rawValue,
        sourceLocation: explicitCompany.sourceLocation,
        extractionRule: "metadata.block.company",
        confidence: "HIGH",
        agreementWithOpportunity: buildAgreement(explicitCompany.value, context.opportunityCompanyName)
      })
    : aboutHeadingCompany
      ? makeScalarField({
          value: aboutHeadingCompany.value,
          sourceText: aboutHeadingCompany.sourceText,
          sourceLocation: aboutHeadingCompany.sourceLocation,
          extractionRule: aboutHeadingCompany.extractionRule,
          confidence: aboutHeadingCompany.confidence,
          agreementWithOpportunity: buildAgreement(
            aboutHeadingCompany.value,
            context.opportunityCompanyName
          )
        })
      : companyHeaderLine
        ? makeScalarField({
            value: companyHeaderLine.text.trim(),
            sourceText: companyHeaderLine.text.trim(),
            sourceLocation: buildLocation(companyHeaderLine.number),
            extractionRule: "metadata.header.company",
            confidence: "MEDIUM",
            agreementWithOpportunity: buildAgreement(
              companyHeaderLine.text.trim(),
              context.opportunityCompanyName
            )
          })
    : null;
  const roleTitle = explicitRole
    ? makeScalarField({
        value: explicitRole.value,
        sourceText: explicitRole.rawValue,
        sourceLocation: explicitRole.sourceLocation,
        extractionRule: "metadata.block.role",
        confidence: "HIGH",
        agreementWithOpportunity: buildAgreement(explicitRole.value, context.opportunityRoleTitle)
      })
    : roleHeaderLine
      ? makeScalarField({
          value: roleHeaderLine.text.trim(),
          sourceText: roleHeaderLine.text.trim(),
          sourceLocation: buildLocation(roleHeaderLine.number),
          extractionRule: "metadata.header.role",
          confidence: "HIGH",
          agreementWithOpportunity: buildAgreement(
            roleHeaderLine.text.trim(),
            context.opportunityRoleTitle
          )
        })
    : null;

  if (companyName?.agreementWithOpportunity === "DIFFERENT") {
    addDiagnostic(
      diagnostics,
      "COMPANY_MISMATCH_WITH_OPPORTUNITY",
      "WARNING",
      `Parsed company "${companyName.value}" differs from opportunity company "${context.opportunityCompanyName}".`,
      "metadata.company.compare",
      companyName.sourceLocation
    );
  }

  if (roleTitle?.agreementWithOpportunity === "DIFFERENT") {
    addDiagnostic(
      diagnostics,
      "ROLE_MISMATCH_WITH_OPPORTUNITY",
      "WARNING",
      `Parsed role "${roleTitle.value}" differs from opportunity role "${context.opportunityRoleTitle}".`,
      "metadata.role.compare",
      roleTitle.sourceLocation
    );
  }

  const normalizedLocation = explicitLocation
    ? normalizeLocationMetadata(explicitLocation.value)
    : null;
  const remoteSignals = [
    explicitWorkArrangement?.value ?? "",
    explicitLocation?.value ?? "",
    combinedText
  ].join("\n");
  const hasRemote = remotePattern.test(remoteSignals);
  const hasHybrid = hybridPattern.test(combinedText);
  const hasOnsite = onsitePattern.test(combinedText) && !hasRemote && !hasHybrid;
  const workArrangementSource =
    explicitWorkArrangement?.rawValue ??
    explicitLocation?.rawValue ??
    lines.find((line) => remotePattern.test(line.text) || hybridPattern.test(line.text) || onsitePattern.test(line.text))?.text.trim() ??
    "";
  const workArrangementLocation =
    explicitWorkArrangement?.sourceLocation ??
    explicitLocation?.sourceLocation ??
    buildLocation(1);
  const workArrangementValue = hasRemote && hasHybrid
    ? "REMOTE_WITH_HYBRID_CONDITION"
    : hasRemote
      ? "REMOTE"
      : hasHybrid
        ? "HYBRID"
        : hasOnsite
          ? "ONSITE"
          : null;
  const workArrangement = workArrangementValue
    ? makeScalarField({
        value: workArrangementValue,
        sourceText: workArrangementSource,
        sourceLocation: workArrangementLocation,
        extractionRule:
          workArrangementValue === "REMOTE_WITH_HYBRID_CONDITION"
            ? "metadata.workArrangement.remoteHybrid"
            : workArrangementValue === "REMOTE"
              ? "metadata.workArrangement.remote"
              : workArrangementValue === "HYBRID"
                ? "metadata.workArrangement.hybrid"
                : "metadata.workArrangement.onsite",
        confidence: workArrangementValue === "REMOTE_WITH_HYBRID_CONDITION" ? "MEDIUM" : "HIGH",
        agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
      })
    : null;

  if (workArrangementValue === "REMOTE_WITH_HYBRID_CONDITION") {
    addDiagnostic(
      diagnostics,
      "AMBIGUOUS_WORK_ARRANGEMENT",
      "WARNING",
      "The description contains remote eligibility with a separate hybrid location condition.",
      "metadata.workArrangement.ambiguous",
      workArrangementLocation
    );
  }

  const employmentSourceText = [
    explicitEmploymentType?.rawValue ?? "",
    combinedText
  ].join("\n");
  const employmentTypeMatch = employmentPatterns.find((item) =>
    item.pattern.test(employmentSourceText)
  );
  const employmentLine =
    explicitEmploymentType
      ? {
          text: explicitEmploymentType.rawValue,
          number: explicitEmploymentType.sourceLocation.startLine
        }
      : lines.find((line) => employmentTypeMatch?.pattern.test(line.text));
  const senioritySourceText = [
    roleTitle?.value ?? "",
    metadataBlock.headerLines.map((line) => line.text).join("\n"),
    combinedText.match(
      /\b(all levels|multiple levels|across multiple levels|final level will be determined during the interview process)\b/i
    )?.[0] ?? ""
  ].join("\n");
  const seniorityMatch = /\b(all levels|multiple levels|across multiple levels|final level will be determined during the interview process)\b/i.test(
    senioritySourceText
  )
    ? { value: "MULTI_LEVEL", pattern: /\b(all levels|multiple levels)\b/i }
    : seniorityPatterns.find((item) => item.pattern.test(roleTitle?.value ?? senioritySourceText));
  const seniorityLine =
    seniorityMatch?.value === "MULTI_LEVEL"
      ? roleTitle
        ? {
            text: roleTitle.sourceText,
            number: roleTitle.sourceLocation.startLine
          }
        : lines.find((line) => /all levels|multiple levels/i.test(line.text))
      : lines.find((line) => seniorityMatch?.pattern.test(line.text));
  const travelMatch = combinedText.match(travelPattern);
  const travelLine = lines.find((line) => travelPattern.test(line.text));
  const clearanceMatch = combinedText.match(clearancePattern);
  const clearanceLine = lines.find((line) => clearancePattern.test(line.text));
  const visaMatch = combinedText.match(visaPattern);
  const visaLine = lines.find((line) => visaPattern.test(line.text));

  return {
    companyName,
    roleTitle,
    seniority: seniorityMatch && seniorityLine
      ? makeScalarField({
          value: seniorityMatch.value,
          sourceText: seniorityLine.text.trim(),
          sourceLocation: buildLocation(seniorityLine.number),
          extractionRule: "metadata.seniority.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    employmentType: employmentTypeMatch && employmentLine
      ? makeScalarField({
          value: employmentTypeMatch.value,
          sourceText: employmentLine.text.trim(),
          sourceLocation: buildLocation(employmentLine.number),
          extractionRule: "metadata.employmentType.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    workArrangement,
    location: normalizedLocation
      ? makeScalarField({
          value: normalizedLocation.primaryLocation,
          sourceText: normalizedLocation.rawLocation,
          sourceLocation: explicitLocation?.sourceLocation ?? buildLocation(1),
          extractionRule: "metadata.location.normalized",
          confidence: normalizedLocation.primaryLocation === normalizedLocation.rawLocation ? "MEDIUM" : "HIGH",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : workArrangementValue === "REMOTE"
        ? makeScalarField({
            value: "Remote",
            sourceText: workArrangementSource,
            sourceLocation: workArrangementLocation,
            extractionRule: "metadata.location.remoteFallback",
            confidence: "MEDIUM",
            agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
          })
      : null,
    secondaryLocation: normalizedLocation?.secondaryLocation
      ? makeScalarField({
          value: /\bbay area\b/i.test(combinedText)
            ? `${normalizedLocation.secondaryLocation} (Bay Area hybrid)`
            : normalizedLocation.secondaryLocation,
          sourceText: normalizedLocation.rawLocation,
          sourceLocation: explicitLocation?.sourceLocation ?? buildLocation(1),
          extractionRule: "metadata.location.secondary",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    department: explicitDepartment
      ? makeScalarField({
          value: explicitDepartment.value,
          sourceText: explicitDepartment.rawValue,
          sourceLocation: explicitDepartment.sourceLocation,
          extractionRule: "metadata.block.department",
          confidence: "HIGH",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    requisitionId: explicitRequisitionId
      ? makeScalarField({
          value: explicitRequisitionId.value,
          sourceText: explicitRequisitionId.rawValue,
          sourceLocation: explicitRequisitionId.sourceLocation,
          extractionRule: "metadata.block.requisitionId",
          confidence: "HIGH",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    postedText: explicitPostedText
      ? makeScalarField({
          value: explicitPostedText.value,
          sourceText: explicitPostedText.rawValue,
          sourceLocation: explicitPostedText.sourceLocation,
          extractionRule: "metadata.block.postedText",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    travelRequirement: travelMatch && travelLine
      ? makeScalarField({
          value: travelMatch[0],
          sourceText: travelLine.text.trim(),
          sourceLocation: buildLocation(travelLine.number),
          extractionRule: "metadata.travel.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    clearanceRequirement: clearanceMatch && clearanceLine
      ? makeScalarField({
          value: clearanceMatch[0],
          sourceText: clearanceLine.text.trim(),
          sourceLocation: buildLocation(clearanceLine.number),
          extractionRule: "metadata.clearance.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null,
    visaWorkAuthorization: visaMatch && visaLine
      ? makeScalarField({
          value: visaMatch[0],
          sourceText: visaLine.text.trim(),
          sourceLocation: buildLocation(visaLine.number),
          extractionRule: "metadata.visa.keyword",
          confidence: "MEDIUM",
          agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
        })
      : null
  };
}

function extractEducationAndCertifications(
  qualifications: QualificationRequirement[]
) {
  const educationRequirements: EducationRequirement[] = [];
  const normalizedCertifications: Array<{
    id: string;
    name: string;
    preferred: boolean;
    sourceText: string;
    sourceLocation: SourceLocation;
    confidence: ConfidenceLevel;
  }> = [];

  qualifications.forEach((qualification, index) => {
    if (qualification.degreeRequirement || equivalentExperiencePattern.test(qualification.originalText)) {
      const educationSentence = qualification.originalText.split(/[.;]/, 1)[0]?.trim() ?? qualification.originalText;
      educationRequirements.push({
        id: `education-${index + 1}-${slugify(qualification.originalText) || "item"}`,
        degreeLevel: qualification.degreeRequirement?.match(degreePattern)?.[0] ?? qualification.degreeRequirement,
        degreeField:
          educationSentence.match(
            /\bin\s+([A-Za-z /-]+?)(?=\s+(?:and\s+\d+\+?\s+years?|or\s+equivalent(?:\s+combination\s+of\s+education\s+and\s+experience|\s+experience)?|$))/i
          )?.[1]?.trim() ?? null,
        equivalentExperience: equivalentExperiencePattern.test(educationSentence)
          ? educationSentence.match(equivalentExperiencePattern)?.[0] ?? null
          : null,
        sourceText: qualification.originalText,
        sourceLocation: qualification.sourceLocation,
        confidence: qualification.degreeRequirement ? "HIGH" : "MEDIUM"
      });
    }

    if (qualification.certificationRequirement) {
      normalizedCertifications.push({
        id: `certification-${index + 1}-${slugify(qualification.certificationRequirement) || "item"}`,
        name: qualification.certificationRequirement,
        preferred: qualification.explicitLabel === "PREFERRED" || qualification.explicitLabel === "BONUS",
        sourceText: qualification.originalText,
        sourceLocation: qualification.sourceLocation,
        confidence: "HIGH"
      });
    }
  });

  return {
    educationRequirements,
    certificationRequirements: normalizedCertifications
  };
}

function extractBenefits(sections: DetectedSection[], lines: SegmentedLine[]): Benefit[] {
  const benefits: Benefit[] = [];

  for (const section of sections.filter((item) => item.type === "BENEFITS")) {
    const statements = segmentStatements(section, lines);
    statements.forEach((statement, index) => {
      benefits.push({
        id: `benefit-${section.startLine}-${index + 1}-${slugify(statement.text) || "item"}`,
        name: statement.text,
        sourceText: statement.text,
        sourceLocation: statement.sourceLocation,
        confidence: "MEDIUM"
      });
    });
  }

  return benefits;
}

function detectDuplicateStatements(
  responsibilities: Responsibility[],
  qualifications: QualificationRequirement[],
  diagnostics: ParserDiagnostic[]
) {
  const normalizedStatements = new Map<string, SourceLocation>();

  for (const responsibility of responsibilities) {
    if (normalizedStatements.has(responsibility.normalizedText)) {
      addDiagnostic(
        diagnostics,
        "DUPLICATE_RESPONSIBILITY_TEXT",
        "INFO",
        `Duplicate responsibility text detected: ${responsibility.text}`,
        "responsibilities.duplicate",
        responsibility.sourceLocation
      );
    } else {
      normalizedStatements.set(responsibility.normalizedText, responsibility.sourceLocation);
    }
  }

  for (const qualification of qualifications) {
    if (normalizedStatements.has(qualification.normalizedText)) {
      addDiagnostic(
        diagnostics,
        "DUPLICATE_REQUIREMENT_TEXT",
        "INFO",
        `Duplicate requirement text detected: ${qualification.originalText}`,
        "requirements.duplicate",
        qualification.sourceLocation
      );
    } else {
      normalizedStatements.set(qualification.normalizedText, qualification.sourceLocation);
    }
  }
}

export function parseNormalizedJobDescription(
  context: ParseContext
): ParsedJobDescriptionRun {
  const diagnostics: ParserDiagnostic[] = [];
  const rawLines = segmentLines(context.normalizedText);
  const lines = removeWorkdayWrapperNoise(context, rawLines, diagnostics);
  const metadataBlock = extractLeadingMetadataBlock(lines, diagnostics);
  const contentLines = lines.filter((line) => !metadataBlock.consumedLineNumbers.has(line.number));

  if (lines.length < 3) {
    addDiagnostic(
      diagnostics,
      "DESCRIPTION_TOO_SHORT",
      "ERROR",
      "The normalized job description is too short to parse reliably.",
      "parser.length.minimum"
    );
  }

  const rawSections = detectSections(contentLines, diagnostics);
  const sections = toDetectedSections(rawSections);

  if (!sections.some((section) => section.type === "RESPONSIBILITIES")) {
    addDiagnostic(
      diagnostics,
      "NO_RESPONSIBILITIES_SECTION",
      "WARNING",
      "No responsibilities section was detected.",
      "section.requirements.responsibilities"
    );
  }

  if (
    !sections.some(
      (section) =>
        qualificationSectionTypes.has(section.type)
    )
  ) {
    addDiagnostic(
      diagnostics,
      "NO_REQUIREMENTS_SECTION",
      "WARNING",
      "No qualifications or requirements section was detected.",
      "section.requirements.qualifications"
    );
  }

  const responsibilities = extractResponsibilities(sections, lines, diagnostics);
  const { qualifications, experienceRequirements } = extractQualificationsAndExperience(
    sections,
    lines,
    diagnostics
  );
  const technologies = collectTechnologyMentions(responsibilities, qualifications);
  const compensation = extractCompensation(sections, lines, metadataBlock, diagnostics);
  const roleMetadata = extractRoleMetadata(context, lines, metadataBlock, diagnostics);
  const { educationRequirements, certificationRequirements } =
    extractEducationAndCertifications(qualifications);
  const benefits = extractBenefits(sections, lines);

  detectDuplicateStatements(responsibilities, qualifications, diagnostics);

  const parsedAt = (context.parsedAt ?? new Date()).toISOString();
  const parserVersion = context.parserVersion ?? JOB_DESCRIPTION_PARSER_VERSION;
  const contractVersion = context.contractVersion ?? JOB_DESCRIPTION_PARSE_CONTRACT_VERSION;
  const result: ParsedJobDescriptionContract = {
    contractVersion,
    parserVersion,
    parsedAt,
    jobDescriptionVersionId: context.jobDescriptionVersionId,
    opportunityId: context.opportunityId,
    companyName: context.opportunityCompanyName,
    roleTitle: context.opportunityRoleTitle,
    sourceUrl: context.sourceUrl,
    sourceChecksum: context.sourceChecksum,
    sections,
    roleMetadata,
    compensation,
    responsibilities,
    qualifications,
    technologies,
    experienceRequirements,
    educationRequirements,
    certificationRequirements,
    benefits
  };

  const validated = parsedJobDescriptionContractSchema.safeParse(result);
  if (!validated.success) {
    addDiagnostic(
      diagnostics,
      "PARSE_CONTRACT_VALIDATION_FAILED",
      "ERROR",
      "The parsed result failed contract validation.",
      "parser.contract.validate"
    );

    return {
      status: "FAILED",
      diagnostics,
      result: null
    };
  }

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "ERROR");
  const hasWarnings = diagnostics.some((diagnostic) => diagnostic.severity === "WARNING");

  return {
    status: hasErrors ? "FAILED" : hasWarnings ? "SUCCESS_WITH_WARNINGS" : "SUCCESS",
    diagnostics,
    result: hasErrors ? null : validated.data
  };
}
