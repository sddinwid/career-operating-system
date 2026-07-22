import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = path.join(
  process.cwd(),
  "src",
  "components",
  "evidence",
  "evidence-requirement-explorer.tsx"
);

describe("EvidenceRequirementExplorer module boundary", () => {
  it("keeps a client boundary and avoids server-only imports", () => {
    const source = readFileSync(componentPath, "utf8");

    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toContain('from "@/lib/evidence-retrieval/presentation-types"');
    expect(source).not.toContain('from "@/lib/evidence-retrieval/presentation"');
    expect(source).not.toContain("@prisma/client");
    expect(source).not.toContain("server-only");
    expect(source).not.toContain('from "node:fs"');
    expect(source).not.toContain('from "fs"');
    expect(source).not.toContain('from "node:crypto"');
    expect(source).not.toContain('from "crypto"');
    expect(source).not.toContain("cookies(");
    expect(source).not.toContain("headers(");
  });
});
