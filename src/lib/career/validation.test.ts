import { describe, expect, it } from "vitest";
import {
  CAREER_CONTRACT_VERSION,
  canonicalCareerKnowledgeContractSchema
} from "@/lib/career/contracts";
import { normalizeCareerKnowledgeSource } from "@/lib/career/normalize";
import {
  validateCanonicalCareerKnowledgeContract,
  validateCareerKnowledgeSource
} from "@/lib/career/validation";
import fixture from "../../../fixtures/career_knowledge_base_fixture_v1.json";

function buildValidContract() {
  return normalizeCareerKnowledgeSource(fixture);
}

describe("career knowledge validation", () => {
  it("accepts a valid canonical contract", () => {
    const contract = buildValidContract();
    const result = validateCanonicalCareerKnowledgeContract(contract);

    expect(result.success).toBe(true);
    expect(result.summary.errorCount).toBe(0);
  });

  it("rejects invalid top-level source structure", () => {
    const result = validateCareerKnowledgeSource({
      _meta: {},
      candidateProfile: {}
    });

    expect(result.success).toBe(false);
    expect(result.summary.errorCount).toBeGreaterThan(0);
  });

  it("rejects missing required identifiers", () => {
    const contract = buildValidContract();
    contract.skills[0] = {
      ...contract.skills[0],
      id: ""
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(result.success).toBe(false);
  });

  it("reports duplicate identifiers", () => {
    const contract = buildValidContract();
    contract.projects[0] = {
      ...contract.projects[0],
      id: contract.employment[0]!.id
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(result.findings.some((item) => item.code === "DUPLICATE_IDENTIFIER")).toBe(
      true
    );
  });

  it("reports invalid dates and conflicting dates", () => {
    const contract = buildValidContract();
    contract.employment[0] = {
      ...contract.employment[0],
      startDate: {
        raw: "2026-13",
        normalized: "2026-13",
        precision: "UNKNOWN"
      },
      endDate: {
        raw: "2024-01",
        normalized: "2024-01",
        precision: "MONTH"
      }
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some((item) => item.code === "UNKNOWN_DATE_PRECISION")
    ).toBe(true);
    expect(
      result.findings.some((item) => item.code === "EMPLOYMENT_DATE_CONFLICT")
    ).toBe(true);
  });

  it("reports missing evidence references", () => {
    const contract = buildValidContract();
    contract.evidence[0] = {
      ...contract.evidence[0],
      associatedEmploymentId: "missing_employment"
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some(
        (item) => item.code === "EVIDENCE_EMPLOYMENT_REFERENCE_MISSING"
      )
    ).toBe(true);
  });

  it("reports skill references missing evidence", () => {
    const contract = buildValidContract();
    contract.skills[0] = {
      ...contract.skills[0],
      evidenceReferences: ["missing_evidence"]
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some(
        (item) => item.code === "SKILL_EVIDENCE_REFERENCE_MISSING"
      )
    ).toBe(true);
  });

  it("reports expired certification inconsistency", () => {
    const contract = buildValidContract();
    contract.certifications[0] = {
      ...contract.certifications[0],
      status: "CURRENT",
      expirationDate: {
        raw: "2020-01-01",
        normalized: "2020-01-01",
        precision: "DATE"
      }
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some(
        (item) => item.code === "CERTIFICATION_STATUS_CONFLICT"
      )
    ).toBe(true);
  });

  it("validates Scott-specific experience-year rules", () => {
    const contract = buildValidContract();
    contract.generationRules.experienceClaimRules.maxYearsPerSkill = 7;

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some((item) => item.code === "EXPERIENCE_RULE_UNEXPECTED")
    ).toBe(true);
  });

  it("validates stack-order rules", () => {
    const contract = buildValidContract();
    contract.generationRules.stackOrderingRules[0] = {
      ...contract.generationRules.stackOrderingRules[0],
      priorityOrder: []
    };

    const result = validateCanonicalCareerKnowledgeContract(contract);
    expect(
      result.findings.some((item) => item.code === "STACK_ORDER_RULE_INVALID")
    ).toBe(true);
  });

  it("reports secret-like values without exposing them", () => {
    const source = {
      ...fixture,
      candidateProfile: {
        ...fixture.candidateProfile,
        notes: "token=super-secret-token-value"
      }
    };

    const result = validateCareerKnowledgeSource(source);
    const finding = result.findings.find((item) => item.code === "SECRET_TOKEN");

    expect(finding).toBeTruthy();
    expect(finding?.message).not.toContain("super-secret-token-value");
  });

  it("normalizes safe representational differences", () => {
    const normalized = normalizeCareerKnowledgeSource({
      ...fixture,
      candidateProfile: {
        ...fixture.candidateProfile,
        linkedin: " fixture.example.com/profile "
      }
    });

    expect(normalized.candidate.contacts.linkedinUrl).toBe(
      "https://fixture.example.com/profile"
    );
  });

  it("allows unknown source fields while preserving contract version validation", () => {
    const source = {
      ...fixture,
      extraSection: {
        ignored: true
      }
    };
    const sourceResult = validateCareerKnowledgeSource(source);
    expect(
      sourceResult.findings.some(
        (item) => item.code === "SOURCE_UNKNOWN_TOP_LEVEL_FIELD"
      )
    ).toBe(true);

    const contract = buildValidContract();
    const parsed = canonicalCareerKnowledgeContractSchema.parse(contract);
    expect(parsed.schemaVersion).toBe(CAREER_CONTRACT_VERSION);
  });
});
