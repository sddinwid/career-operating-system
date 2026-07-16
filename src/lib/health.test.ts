import { describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock
  }
}));

describe("getHealthStatus", () => {
  it("returns ok when the database responds", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);

    const { getHealthStatus } = await import("@/lib/health");
    const result = await getHealthStatus();

    expect(result.application).toBe("ok");
    expect(result.database).toBe("ok");
    expect(result.checkedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("returns an error state when the database query fails", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection refused"));

    const { getHealthStatus } = await import("@/lib/health");
    const result = await getHealthStatus();

    expect(result.application).toBe("ok");
    expect(result.database).toBe("error");
    expect(result.details).toContain("connection refused");
  });
});
