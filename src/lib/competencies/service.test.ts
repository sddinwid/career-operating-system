import { describe, expect, it } from "vitest";
import { competencyCatalog } from "@/lib/competencies/catalog";
import {
  computeCompetencyCatalogChecksum,
  mapEvidenceToCompetencies,
  mapRequirementToCompetencies,
  validateCompetencyCatalog
} from "@/lib/competencies/service";

describe("competency catalog", () => {
  it("validates the catalog and produces a deterministic checksum", () => {
    const first = validateCompetencyCatalog();
    const second = computeCompetencyCatalogChecksum(competencyCatalog);

    expect(first.version).toBe("m8.8.0");
    expect(first.checksum).toBe(second);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps RESTful and collaboration requirement language to explicit competencies", () => {
    const mapping = mapRequirementToCompetencies({
      id: "requirement-1",
      originalText:
        "Solid understanding of RESTful design and collaborate with engineering, product, and infrastructure",
      correctedDisplayText: null,
      technologies: [],
      kinds: ["ARCHITECTURE", "COLLABORATION", "COMMUNICATION"],
      experienceText: null
    });

    expect(mapping.competencies.map((item) => item.competencyName)).toEqual(
      expect.arrayContaining([
        "REST API Design",
        "Cross-Functional Collaboration",
        "Product Collaboration"
      ])
    );
    expect(mapping.components.some((item) => item.label === "restful design")).toBe(true);
  });

  it("maps throughput evidence without falsely creating low-latency support", () => {
    const evidenceMatches = mapEvidenceToCompetencies({
      displayTitle: "Platform optimization",
      claimText: "Improved throughput and deployment reliability for PostgreSQL services.",
      technologies: ["PostgreSQL", "AWS", "CI/CD"],
      context: "PROFESSIONAL",
      evidenceType: "ACCOMPLISHMENT",
      recordKind: "SOURCE_FACT",
      sourceProvenance: {
        sourceSection: "employment",
        sourceId: "employment-1",
        sourcePath: "employment[0].accomplishments[0]"
      },
      restrictions: []
    });

    expect(evidenceMatches.map((item) => item.competencyName)).toEqual(
      expect.arrayContaining([
        "Throughput Optimization",
        "Performance Engineering",
        "Release Reliability"
      ])
    );
    expect(evidenceMatches.map((item) => item.competencyName)).not.toContain("Latency Reduction");
  });
});
