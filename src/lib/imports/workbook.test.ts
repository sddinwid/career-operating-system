import { describe, expect, it } from "vitest";
import { buildPreviewRowsFromFixture, readFixtureWorkbookInspection } from "@/lib/imports/workbook";

describe("fixture workbook inspection", () => {
  it("detects Tracker and Dashboard sheets and finds the actual tracker header row", () => {
    const inspection = readFixtureWorkbookInspection();

    expect(inspection.filename).toBe("job_outreach_tracker-July-US.xlsx");
    expect(inspection.trackerSheetName).toBe("Tracker");
    expect(inspection.dashboardSheetName).toBe("Dashboard");
    expect(inspection.trackerHeaderRowNumber).toBe(3);
    expect(inspection.trackerHeaders).toContain("Status");
    expect(inspection.trackerHeaders).toContain("Date of Application");
    expect(inspection.trackerHeaders).toContain("Company");
    expect(inspection.trackerHeaders).toContain("Position/Role");
  });

  it("builds raw and normalized preview rows without mutating the fixture", () => {
    const inspection = readFixtureWorkbookInspection();
    const preview = buildPreviewRowsFromFixture(inspection.inferredMapping, []);

    expect(preview.rows.length).toBeGreaterThan(0);
    expect(preview.summary.totalRows).toBe(preview.rows.length);
    expect(preview.rows[0]?.sheetName).toBe("Tracker");
    expect(preview.rows[0]?.sourceColumns).toBeTruthy();
    expect(preview.rows[0]?.authoritativeData.companyName).toBeTruthy();
    expect(preview.rows[0]?.authoritativeData.appliedAtPrecision).toBe("DATE_ONLY");
    expect(
      preview.rows.some((row) => Object.keys(row.derivedData).length > 0)
    ).toBe(true);
  });

  it("classifies every meaningful fixture row explicitly for reconciliation", () => {
    const inspection = readFixtureWorkbookInspection();
    const preview = buildPreviewRowsFromFixture(inspection.inferredMapping, []);

    expect(preview.summary.totalRows).toBe(98);
    expect(preview.summary.classificationCounts.warning).toBe(18);
    expect(preview.summary.classificationCounts.invalid).toBe(56);
    expect(preview.summary.classificationCounts.skipped_informational).toBe(24);
    expect(
      preview.rows.every(
        (row) =>
          Boolean(row.classification) &&
          Boolean(row.proposedRecordType) &&
          Boolean(row.recommendedHandling)
      )
    ).toBe(true);
  });
});
