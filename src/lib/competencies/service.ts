import { createHash } from "node:crypto";
import type { CandidateEvidence } from "@/lib/evidence-retrieval/contract";
import type {
  CompetencyCatalog,
  CompetencyDefinition,
  CompetencyEvidenceFamily,
  CompetencyRelationshipStrength,
  MatchedCompetency,
  RequirementCompetencyComponent
} from "@/lib/competencies/contract";
import {
  COMPETENCY_MAPPING_ENGINE_VERSION,
  matchedCompetencySchema,
  requirementCompetencyComponentSchema
} from "@/lib/competencies/contract";
import { competencyCatalog } from "@/lib/competencies/catalog";
import type {
  AnalyzedRequirement,
  AnalyzedResponsibility,
  RequirementKind
} from "@/lib/job-descriptions/requirement-analysis-contract";

type SourceRequirement = Pick<
  AnalyzedRequirement,
  "id" | "originalText" | "correctedDisplayText" | "technologies" | "kinds" | "experienceText"
> | Pick<
  AnalyzedResponsibility,
  "id" | "originalText" | "correctedDisplayText" | "technologies" | "kinds"
> & {
  experienceText?: string | null;
};

type CatalogIndex = {
  byId: Map<string, CompetencyDefinition>;
  ordered: CompetencyDefinition[];
};

type MatchSeed = {
  definition: CompetencyDefinition;
  strength: CompetencyRelationshipStrength;
  matchedSignals: Set<string>;
  direct: boolean;
  inferred: boolean;
};

const strengthOrder: Record<CompetencyRelationshipStrength, number> = {
  EXACT: 5,
  DIRECT: 4,
  STRONG_IMPLICATION: 3,
  SUPPORTING: 2,
  WEAK_RELATED: 1,
  NONE: 0
};

const impliedStrengthByField = {
  stronglyImpliedCompetencyIds: "STRONG_IMPLICATION",
  relatedCompetencyIds: "SUPPORTING",
  weaklyRelatedCompetencyIds: "WEAK_RELATED",
  parentCompetencyIds: "SUPPORTING"
} as const satisfies Record<string, CompetencyRelationshipStrength>;

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizedBlob(values: Array<string | null | undefined>) {
  return ` ${values
    .flatMap((value) => (value ?? "").split(/[^a-zA-Z0-9+#.]+/g))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()} `;
}

function hasPhrase(blob: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) {
    return false;
  }
  return blob.includes(` ${normalizedPhrase} `);
}

function rankStrength(
  current: CompetencyRelationshipStrength,
  next: CompetencyRelationshipStrength
) {
  return strengthOrder[next] > strengthOrder[current] ? next : current;
}

function detectEvidenceFamily(candidate: Pick<CandidateEvidence, "evidenceType" | "context" | "recordKind" | "sourceProvenance" | "restrictions">): CompetencyEvidenceFamily {
  if (candidate.evidenceType === "METRIC") {
    return candidate.context === "PROJECT" ? "PROJECT_ACCOMPLISHMENT" : "PROFESSIONAL_METRIC";
  }
  if (candidate.evidenceType === "ACCOMPLISHMENT") {
    return candidate.context === "PROJECT"
      ? "PROJECT_ACCOMPLISHMENT"
      : "PROFESSIONAL_ACCOMPLISHMENT";
  }
  if (candidate.evidenceType === "RESPONSIBILITY") {
    return candidate.context === "PROJECT"
      ? "PROJECT_RECORD"
      : "PROFESSIONAL_RESPONSIBILITY";
  }
  if (candidate.evidenceType === "ROLE") {
    return "PROFESSIONAL_ROLE";
  }
  if (candidate.evidenceType === "LEADERSHIP") {
    return "LEADERSHIP_EXAMPLE";
  }
  if (candidate.evidenceType === "ARCHITECTURE") {
    return candidate.context === "PROJECT" ? "PROJECT_ARCHITECTURE" : "ARCHITECTURE_EXAMPLE";
  }
  if (candidate.evidenceType === "INTERVIEW_STORY") {
    return "INTERVIEW_STORY";
  }
  if (candidate.evidenceType === "PROJECT" || candidate.evidenceType === "PROJECT_RESPONSIBILITY") {
    return "PROJECT_RECORD";
  }
  if (candidate.evidenceType === "PROJECT_ACCOMPLISHMENT") {
    return "PROJECT_ACCOMPLISHMENT";
  }
  if (candidate.evidenceType === "EDUCATION") {
    return "EDUCATION";
  }
  if (candidate.evidenceType === "CERTIFICATION") {
    return candidate.restrictions.some((item) => item.code === "EXPIRED_CERTIFICATION")
      ? "EXPIRED_CERTIFICATION"
      : "ACTIVE_CERTIFICATION";
  }
  if (candidate.evidenceType === "SKILL") {
    return "SKILL_DECLARATION";
  }
  if (candidate.sourceProvenance.sourcePath.includes("resume")) {
    return "RESUME_BULLET";
  }
  return "OTHER";
}

export function computeCompetencyCatalogChecksum(catalog: CompetencyCatalog = competencyCatalog) {
  return createHash("sha256").update(stableSerialize(catalog)).digest("hex");
}

export function getCompetencyCatalogIndex(catalog: CompetencyCatalog = competencyCatalog): CatalogIndex {
  const ordered = [...catalog.competencies].sort((left, right) => left.id.localeCompare(right.id));
  return {
    ordered,
    byId: new Map(ordered.map((definition) => [definition.id, definition]))
  };
}

export function validateCompetencyCatalog(catalog: CompetencyCatalog = competencyCatalog) {
  const index = getCompetencyCatalogIndex(catalog);
  const seenIds = new Set<string>();
  const aliasOwners = new Map<string, string>();

  for (const definition of index.ordered) {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate competency id ${definition.id}.`);
    }
    seenIds.add(definition.id);

    for (const alias of definition.aliases) {
      const normalizedAlias = normalize(alias);
      const owner = aliasOwners.get(normalizedAlias);
      if (owner && owner !== definition.id) {
        throw new Error(`Alias ${alias} is duplicated by ${owner} and ${definition.id}.`);
      }
      aliasOwners.set(normalizedAlias, definition.id);
    }

    for (const referenceId of [
      ...definition.parentCompetencyIds,
      ...definition.relatedCompetencyIds,
      ...definition.stronglyImpliedCompetencyIds,
      ...definition.weaklyRelatedCompetencyIds
    ]) {
      if (!index.byId.has(referenceId)) {
        throw new Error(`Competency ${definition.id} references missing competency ${referenceId}.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Cycle detected in competency parents at ${id}.`);
    }
    visiting.add(id);
    for (const parentId of index.byId.get(id)?.parentCompetencyIds ?? []) {
      visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const definition of index.ordered) {
    visit(definition.id);
  }

  return {
    version: catalog.catalogVersion,
    checksum: computeCompetencyCatalogChecksum(catalog)
  };
}

function allowRequirementKind(definition: CompetencyDefinition, kinds: RequirementKind[]) {
  return (
    definition.allowedRequirementKinds.length === 0 ||
    kinds.some((kind) => definition.allowedRequirementKinds.includes(kind))
  );
}

function mergeSeed(
  seeds: Map<string, MatchSeed>,
  definition: CompetencyDefinition,
  strength: CompetencyRelationshipStrength,
  signal: string,
  direct: boolean,
  inferred: boolean
) {
  const existing = seeds.get(definition.id);
  if (!existing) {
    seeds.set(definition.id, {
      definition,
      strength,
      matchedSignals: new Set([signal]),
      direct,
      inferred
    });
    return;
  }

  existing.strength = rankStrength(existing.strength, strength);
  existing.matchedSignals.add(signal);
  existing.direct = existing.direct || direct;
  existing.inferred = existing.inferred || inferred;
}

function expandRelatedCompetencies(
  seeds: Map<string, MatchSeed>,
  index: CatalogIndex,
  maxDepth = 1
) {
  const queue = [...seeds.values()].map((value) => ({ ...value, depth: 0 }));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }
    for (const [field, strength] of Object.entries(impliedStrengthByField) as Array<
      [keyof typeof impliedStrengthByField, CompetencyRelationshipStrength]
    >) {
      for (const relatedId of current.definition[field]) {
        const related = index.byId.get(relatedId);
        if (!related) {
          continue;
        }
        const nextStrength =
          strengthOrder[strength] >= strengthOrder[current.strength]
            ? current.strength
            : strength;
        const existing = seeds.get(related.id);
        if (existing && strengthOrder[existing.strength] >= strengthOrder[nextStrength]) {
          continue;
        }
        mergeSeed(
          seeds,
          related,
          nextStrength,
          `${current.definition.name} -> ${related.name}`,
          false,
          true
        );
        queue.push({
          definition: related,
          strength: nextStrength,
          matchedSignals: new Set([`${current.definition.name} -> ${related.name}`]),
          direct: false,
          inferred: true,
          depth: current.depth + 1
        });
      }
    }
  }
}

function toMatch(seed: MatchSeed): MatchedCompetency {
  return matchedCompetencySchema.parse({
    competencyId: seed.definition.id,
    competencyName: seed.definition.name,
    category: seed.definition.category,
    relationshipStrength: seed.strength,
    matchedSignals: [...seed.matchedSignals].sort(),
    explanation: seed.direct
      ? `${seed.definition.name} matched explicit requirement or evidence signals.`
      : `${seed.definition.name} was included through a bounded deterministic competency relationship.`,
    direct: seed.direct,
    inferred: seed.inferred
  });
}

function extractRequirementComponents(requirement: SourceRequirement) {
  const title = requirement.correctedDisplayText ?? requirement.originalText;
  const components: Array<{ label: string; oneOfGroup: string | null }> = [];

  for (const technology of requirement.technologies) {
    components.push({ label: technology, oneOfGroup: null });
  }

  const lower = title.toLowerCase();
  if (/\bor\b/.test(lower) && requirement.technologies.length > 1) {
    const groupId = `one-of:${requirement.id}`;
    return requirement.technologies.map((technology) => ({ label: technology, oneOfGroup: groupId }));
  }

  const phraseSignals = [
    "restful design",
    "event-driven systems",
    "security best practices",
    "performance engineering",
    "high-throughput",
    "low-latency",
    "cross-functional collaboration",
    "testing strategy",
    "testable code",
    "test-driven development",
    "continuous improvement",
    "semantic retrieval",
    "ai-powered search",
    "document ingestion"
  ];

  for (const phrase of phraseSignals) {
    if (lower.includes(phrase)) {
      components.push({ label: phrase, oneOfGroup: null });
    }
  }

  if (components.length === 0) {
    components.push({ label: title, oneOfGroup: null });
  }

  const unique = new Map<string, { label: string; oneOfGroup: string | null }>();
  for (const component of components) {
    unique.set(`${component.label.toLowerCase()}::${component.oneOfGroup ?? ""}`, component);
  }
  return [...unique.values()];
}

export function mapRequirementToCompetencies(
  requirement: SourceRequirement,
  catalog: CompetencyCatalog = competencyCatalog
) {
  const index = getCompetencyCatalogIndex(catalog);
  const text = requirement.correctedDisplayText ?? requirement.originalText;
  const blob = normalizedBlob([
    requirement.originalText,
    requirement.correctedDisplayText ?? "",
    requirement.experienceText ?? "",
    ...requirement.technologies
  ]);
  const seeds = new Map<string, MatchSeed>();

  for (const definition of index.ordered) {
    if (!allowRequirementKind(definition, requirement.kinds)) {
      continue;
    }

    const exactTechnology = requirement.technologies.find((technology) =>
      definition.technologySignals.some((signal) => normalize(signal) === normalize(technology))
    );
    if (exactTechnology) {
      mergeSeed(seeds, definition, "EXACT", exactTechnology, true, false);
      continue;
    }

    const directSignals = [
      ...definition.requirementSignals,
      ...definition.aliases,
      ...definition.technologySignals
    ].filter((signal) => hasPhrase(blob, signal));

    if (directSignals.length > 0) {
      const strength = definition.technologySignals.some((signal) =>
        directSignals.some((matched) => normalize(signal) === normalize(matched))
      )
        ? "DIRECT"
        : "DIRECT";
      for (const signal of directSignals) {
        mergeSeed(seeds, definition, strength, signal, true, false);
      }
    }
  }

  expandRelatedCompetencies(seeds, index, 1);

  const matched = [...seeds.values()]
    .filter((seed) => strengthOrder[seed.strength] > 0)
    .sort(
      (left, right) =>
        strengthOrder[right.strength] - strengthOrder[left.strength] ||
        left.definition.name.localeCompare(right.definition.name)
    )
    .map(toMatch);

  const components = extractRequirementComponents(requirement).map((component, indexValue) => {
    const exact = matched.find(
      (item) =>
        item.matchedSignals.some((signal) => normalize(signal) === normalize(component.label)) ||
        normalize(item.competencyName) === normalize(component.label)
    );
    const related =
      exact ??
      matched.find((item) =>
        item.matchedSignals.some((signal) => component.label.toLowerCase().includes(signal.toLowerCase()))
      ) ??
      null;

    return requirementCompetencyComponentSchema.parse({
      componentId: `${requirement.id}:component:${indexValue}`,
      label: component.label,
      competencyId: related?.competencyId ?? null,
      competencyName: related?.competencyName ?? null,
      relationshipStrength: related?.relationshipStrength ?? "NONE",
      matchedSignals: related?.matchedSignals ?? [],
      oneOfGroup: component.oneOfGroup,
      direct: related?.direct ?? false,
      inferred: related?.inferred ?? false,
      explanation: related
        ? related.explanation
        : `No deterministic competency mapping was found for ${component.label}.`
    });
  });

  return {
    catalogVersion: catalog.catalogVersion,
    catalogChecksum: computeCompetencyCatalogChecksum(catalog),
    mappingEngineVersion: COMPETENCY_MAPPING_ENGINE_VERSION,
    competencies: matched,
    components
  };
}

export function mapEvidenceToCompetencies(
  candidate: Pick<
    CandidateEvidence,
    | "displayTitle"
    | "claimText"
    | "technologies"
    | "context"
    | "evidenceType"
    | "recordKind"
    | "sourceProvenance"
    | "restrictions"
  >,
  catalog: CompetencyCatalog = competencyCatalog
) {
  const index = getCompetencyCatalogIndex(catalog);
  const blob = normalizedBlob([candidate.displayTitle, candidate.claimText, ...candidate.technologies]);
  const family = detectEvidenceFamily(candidate);
  const seeds = new Map<string, MatchSeed>();

  for (const definition of index.ordered) {
    if (definition.disallowedEvidenceFamilies.includes(family)) {
      continue;
    }
    const exactTechnology = candidate.technologies.find((technology) =>
      definition.technologySignals.some((signal) => normalize(signal) === normalize(technology))
    );
    if (exactTechnology) {
      mergeSeed(seeds, definition, "EXACT", exactTechnology, true, false);
      continue;
    }

    const signals = [
      ...definition.evidenceSignals,
      ...definition.aliases,
      ...definition.technologySignals
    ].filter((signal) => hasPhrase(blob, signal));
    if (signals.length > 0) {
      for (const signal of signals) {
        mergeSeed(seeds, definition, "DIRECT", signal, true, false);
      }
    }
  }

  expandRelatedCompetencies(seeds, index, 1);

  return [...seeds.values()]
    .filter((seed) => {
      if (seed.definition.preferredEvidenceFamilies.length === 0) {
        return strengthOrder[seed.strength] >= strengthOrder[seed.definition.minimumRelationshipStrength];
      }
      return (
        (seed.definition.preferredEvidenceFamilies.includes(family) ||
          strengthOrder[seed.strength] >= strengthOrder["DIRECT"]) &&
        strengthOrder[seed.strength] >= strengthOrder[seed.definition.minimumRelationshipStrength]
      );
    })
    .sort(
      (left, right) =>
        strengthOrder[right.strength] - strengthOrder[left.strength] ||
        left.definition.name.localeCompare(right.definition.name)
    )
    .map(toMatch);
}

export function relationshipStrengthSortValue(value: CompetencyRelationshipStrength) {
  return strengthOrder[value];
}

export function buildEvidenceClusterId(input: {
  sourceId: string | null;
  sourcePath: string;
  matchedCompetencies: MatchedCompetency[];
  matchedTechnologies: string[];
  employer: string | null;
  role: string | null;
  project: string | null;
}) {
  const root = input.sourceId ?? input.sourcePath.replace(/\[\d+\].*$/, (match) => match.slice(0, 0));
  const competencyPart = input.matchedCompetencies
    .slice(0, 3)
    .map((item) => item.competencyId)
    .sort()
    .join("|");
  const technologyPart = [...input.matchedTechnologies].sort().join("|");
  return createHash("sha1")
    .update(
      stableSerialize({
        root,
        sourcePath: input.sourcePath.replace(/\[\d+\]/g, "[]"),
        competencyPart,
        technologyPart,
        employer: input.employer,
        role: input.role,
        project: input.project
      })
    )
    .digest("hex");
}
