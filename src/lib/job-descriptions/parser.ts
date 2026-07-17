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
  SECTION_ALIAS_DEFINITIONS
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
  type: SectionType;
  startLine: number;
  headingLine: number;
  endLine: number;
  bodyLines: SegmentedLine[];
};

const headingPattern = /^[A-Z][A-Za-z0-9/&,'()\- ]{1,80}:?$/;
const bulletPattern = /^\s*(?:[-*•●◦▪‣]|\d+[.)]|[A-Za-z][.)])\s+/;
const sectionDelimiterPattern = /^\s*[:\-–—]?\s*$/;
const actionVerbPattern =
  /\b(build|design|develop|lead|improve|deliver|manage|create|own|architect|mentor|optimize|maintain|support|collaborate|drive|implement|deploy)\b/gi;
const explicitExperiencePattern =
  /\b(?:(?:at least|minimum of|minimum|over)\s+)?(\d+)(?:\s*-\s*|\s+to\s+)?(\d+)?\s*(\+)?\s+years?\b/i;
const salaryRangePattern =
  /\$?\s?(\d{2,3}(?:,\d{3})+|\d+)(?:\s*-\s*|\s+to\s+)\$?\s?(\d{2,3}(?:,\d{3})+|\d+)/i;
const hourlyPattern =
  /\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:\/\s*hour|per hour|hourly)\b/i;
const annualPattern =
  /\b(per year|annually|annual(?:ly)?|salary range|base salary)\b/i;
const travelPattern = /\b(\d{1,2}%\s*travel|travel up to \d{1,2}%|some travel required)\b/i;
const clearancePattern = /\b(secret clearance|top secret|clearance required|public trust)\b/i;
const visaPattern =
  /\b(authorized to work|work authorization|visa sponsorship|sponsorship available|sponsorship not available)\b/i;
const degreePattern =
  /\b(bachelor'?s?|master'?s?|ph\.?d\.?|doctorate|bs|ba|ms|mba)\b[^.\n;]*/i;
const certificationPattern =
  /\b(certified|certification|aws certified|security\+|cissp|pmp|scrum master)\b[^.\n;]*/i;
const equivalentExperiencePattern = /\b(equivalent experience|or equivalent practical experience)\b/i;
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

function normalizeHeadingText(value: string) {
  return value.replace(/[:\-–—]+$/, "").trim();
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

function isHeadingLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (detectSectionTypeFromHeading(trimmed) !== "OTHER") {
    return true;
  }

  return headingPattern.test(trimmed) && !bulletPattern.test(trimmed);
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
        type: "OVERVIEW",
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
      type: "OVERVIEW",
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
    const type = detectSectionTypeFromHeading(normalizeHeadingText(current.text));
    if (type === "OTHER") {
      addDiagnostic(
        diagnostics,
        "UNRECOGNIZED_SECTION_HEADING",
        "INFO",
        `Unrecognized section heading preserved as Other: ${normalizeHeadingText(current.text)}`,
        "section.heading.other",
        buildLocation(current.number)
      );
    }

    sections.push({
      heading: normalizeHeadingText(current.text) || "Other",
      type,
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
  return sections.map((section, index) => ({
    id: `section-${index + 1}-${slugify(section.heading || section.type) || "section"}`,
    heading: section.heading,
    type: section.type,
    startLine: section.startLine,
    endLine: section.endLine,
    text: section.bodyLines.map((line) => line.text).join("\n").trim(),
    confidence: section.type === "OTHER" ? "LOW" : "HIGH",
    detectionRule:
      section.type === "OVERVIEW" ? "section.preamble" : "section.heading.alias"
  }));
}

function cleanStatementText(value: string) {
  return value
    .replace(bulletPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphIntoStatements(text: string): string[] {
  if (!text.includes(";")) {
    return [text];
  }

  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
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

function findTechnologyMentionsInText(
  text: string,
  dictionary: TechnologyDictionaryEntry[]
) {
  const matches: Array<{ entry: TechnologyDictionaryEntry; alias: string }> = [];

  for (const entry of dictionary) {
    for (const alias of entry.aliases) {
      const pattern = new RegExp(
        `\\b${escapeRegExp(alias)}\\b`,
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
  lines: SegmentedLine[]
): Responsibility[] {
  const responsibilities: Responsibility[] = [];

  for (const section of sections.filter((item) => item.type === "RESPONSIBILITIES")) {
    const statements = segmentStatements(section, lines);
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

function detectRequirementLabel(sectionType: SectionType, text: string) {
  if (sectionType === "REQUIRED_QUALIFICATIONS") {
    if (/\bminimum\b/i.test(text)) {
      return "MINIMUM" as const;
    }

    return "REQUIRED" as const;
  }

  if (sectionType === "PREFERRED_QUALIFICATIONS") {
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

function extractQualificationsAndExperience(
  sections: DetectedSection[],
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
) {
  const qualifications: QualificationRequirement[] = [];
  const experienceRequirements: ExperienceRequirement[] = [];

  for (const section of sections.filter((item) =>
    item.type === "REQUIRED_QUALIFICATIONS" ||
    item.type === "PREFERRED_QUALIFICATIONS" ||
    item.type === "SKILLS"
  )) {
    const statements = segmentStatements(section, lines);
    statements.forEach((statement, index) => {
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
        technologyReferences[0] ?? null
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
      }

      const degreeRequirementMatch = statement.text.match(degreePattern)?.[0] ?? null;
      const certificationRequirementMatch =
        statement.text.match(certificationPattern)?.[0] ?? null;
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

      qualifications.push({
        id: statementId,
        originalText: statement.text,
        normalizedText: statement.normalizedText,
        sourceSectionId: section.id,
        sourceLocation: statement.sourceLocation,
        explicitLabel: label,
        experienceRequirementId: experienceRequirement?.id ?? null,
        degreeRequirement: degreeRequirementMatch,
        certificationRequirement: certificationRequirementMatch,
        technologyReferences,
        domainReferences,
        leadershipReferences,
        confidence: section.type === "SKILLS" ? "MEDIUM" : "HIGH",
        extractionRule: "requirements.statement.segmented"
      });
    });
  }

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

function extractCompensation(
  sections: DetectedSection[],
  lines: SegmentedLine[],
  diagnostics: ParserDiagnostic[]
): Compensation {
  const compensationLines = lines.filter(
    (line) =>
      sections.some((section) => section.type === "COMPENSATION" && line.number >= section.startLine && line.number <= section.endLine) ||
      /\b(salary|compensation|pay range|\$\d)/i.test(line.text)
  );
  const combinedText = compensationLines.map((line) => line.text.trim()).join(" ");

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
      value: Number(salaryMatch[1]!.replace(/,/g, "")),
      sourceText: salaryMatch[0],
      sourceLocation: location,
      extractionRule: "compensation.salary.range",
      confidence: "HIGH"
    });
    maximumSalary = makeNumericField({
      value: Number(salaryMatch[2]!.replace(/,/g, "")),
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
  diagnostics: ParserDiagnostic[]
): RoleMetadata {
  const firstFiveLines = lines.slice(0, 5).filter((line) => line.text.trim().length > 0);
  const preambleLines = firstFiveLines.filter(
    (line) => detectSectionTypeFromHeading(normalizeHeadingText(line.text)) === "OTHER"
  );
  const companyLine = preambleLines[0] ?? null;
  const titleLine = preambleLines[1] ?? null;
  const combinedText = lines.map((line) => line.text).join("\n");

  const companyName = companyLine
    ? makeScalarField({
        value: companyLine.text.trim(),
        sourceText: companyLine.text.trim(),
        sourceLocation: buildLocation(companyLine.number),
        extractionRule: "metadata.topline.company",
        confidence: "HIGH",
        agreementWithOpportunity: buildAgreement(companyLine.text.trim(), context.opportunityCompanyName)
      })
    : null;
  const roleTitle = titleLine
    ? makeScalarField({
        value: titleLine.text.trim(),
        sourceText: titleLine.text.trim(),
        sourceLocation: buildLocation(titleLine.number),
        extractionRule: "metadata.topline.role",
        confidence: "HIGH",
        agreementWithOpportunity: buildAgreement(titleLine.text.trim(), context.opportunityRoleTitle)
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

  const locationLine = lines.find((line) => remotePattern.test(line.text) || hybridPattern.test(line.text) || onsitePattern.test(line.text) || /^location\b/i.test(line.text));
  const workArrangement = locationLine
    ? makeScalarField({
        value: remotePattern.test(locationLine.text)
          ? "REMOTE"
          : hybridPattern.test(locationLine.text)
            ? "HYBRID"
            : "ONSITE",
        sourceText: locationLine.text.trim(),
        sourceLocation: buildLocation(locationLine.number),
        extractionRule: remotePattern.test(locationLine.text)
          ? "metadata.workArrangement.remote"
          : hybridPattern.test(locationLine.text)
            ? "metadata.workArrangement.hybrid"
            : "metadata.workArrangement.onsite",
        confidence: "HIGH",
        agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
      })
    : null;

  if (
    workArrangement &&
    remotePattern.test(locationLine!.text) &&
    hybridPattern.test(locationLine!.text)
  ) {
    addDiagnostic(
      diagnostics,
      "AMBIGUOUS_WORK_ARRANGEMENT",
      "WARNING",
      "The description contains both remote and hybrid language.",
      "metadata.workArrangement.ambiguous",
      buildLocation(locationLine!.number)
    );
  }

  const employmentTypeMatch = employmentPatterns.find((item) => item.pattern.test(combinedText));
  const employmentLine = lines.find((line) => employmentTypeMatch?.pattern.test(line.text));
  const seniorityMatch = seniorityPatterns.find((item) => item.pattern.test(combinedText));
  const seniorityLine = lines.find((line) => seniorityMatch?.pattern.test(line.text));
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
    location: locationLine
      ? makeScalarField({
          value: locationLine.text.trim(),
          sourceText: locationLine.text.trim(),
          sourceLocation: buildLocation(locationLine.number),
          extractionRule: "metadata.location.line",
          confidence: "LOW",
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
      educationRequirements.push({
        id: `education-${index + 1}-${slugify(qualification.originalText) || "item"}`,
        degreeLevel: qualification.degreeRequirement?.match(degreePattern)?.[0] ?? qualification.degreeRequirement,
        degreeField:
          qualification.originalText.match(/\bin\s+([A-Za-z /-]+?)(?:\s+or equivalent experience)?$/i)?.[1]?.trim() ??
          null,
        equivalentExperience: equivalentExperiencePattern.test(qualification.originalText)
          ? qualification.originalText.match(equivalentExperiencePattern)?.[0] ?? null
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
  const lines = segmentLines(context.normalizedText);

  if (lines.length < 3) {
    addDiagnostic(
      diagnostics,
      "DESCRIPTION_TOO_SHORT",
      "ERROR",
      "The normalized job description is too short to parse reliably.",
      "parser.length.minimum"
    );
  }

  const rawSections = detectSections(lines, diagnostics);
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
        section.type === "REQUIRED_QUALIFICATIONS" ||
        section.type === "PREFERRED_QUALIFICATIONS" ||
        section.type === "SKILLS"
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

  const responsibilities = extractResponsibilities(sections, lines);
  const { qualifications, experienceRequirements } = extractQualificationsAndExperience(
    sections,
    lines,
    diagnostics
  );
  const technologies = collectTechnologyMentions(responsibilities, qualifications);
  const compensation = extractCompensation(sections, lines, diagnostics);
  const roleMetadata = extractRoleMetadata(context, lines, diagnostics);
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
