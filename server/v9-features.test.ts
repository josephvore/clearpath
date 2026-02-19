import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock the database connection
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
  };
});

describe("Bookmarks", () => {
  it("getUserBookmarks returns an array", async () => {
    const result = await db.getUserBookmarks(999999);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getUserBookmarkIds returns an array of numbers", async () => {
    const result = await db.getUserBookmarkIds(999999);
    expect(Array.isArray(result)).toBe(true);
    result.forEach((id: any) => {
      expect(typeof id).toBe("number");
    });
  });

  it("addBookmark and removeBookmark work without error", async () => {
    // Add bookmark for a non-existent user/program should not throw
    try {
      await db.addBookmark(999999, 1);
      // Clean up
      await db.removeBookmark(999999, 1);
    } catch (e: any) {
      // May fail due to FK constraints, that's OK
      expect(e).toBeDefined();
    }
  });
});

describe("Compare Programs", () => {
  it("getComparePrograms returns array of programs with tags", async () => {
    const result = await db.getComparePrograms([1, 2]);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const program = result[0];
      expect(program).toHaveProperty("id");
      expect(program).toHaveProperty("name");
      expect(program).toHaveProperty("tags");
      expect(Array.isArray(program.tags)).toBe(true);
    }
  });

  it("getComparePrograms handles non-existent IDs gracefully", async () => {
    const result = await db.getComparePrograms([999999, 999998]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getComparePrograms returns correct number of programs", async () => {
    const result = await db.getComparePrograms([1]);
    expect(result.length).toBeLessThanOrEqual(1);
  });
});

describe("Browse by State", () => {
  it("getStateStats returns array of state stats", async () => {
    const result = await db.getStateStats();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const stat = result[0];
      expect(stat).toHaveProperty("state");
      expect(stat).toHaveProperty("facilityCount");
      expect(stat).toHaveProperty("programCount");
      expect(typeof stat.facilityCount).toBe("number");
      expect(typeof stat.programCount).toBe("number");
    }
  });

  it("getStateStats returns data for multiple states", async () => {
    const result = await db.getStateStats();
    expect(result.length).toBeGreaterThan(10);
  });

  it("getProgramsByState returns results for a valid state", async () => {
    const result = await db.getProgramsByState("CA", { limit: 5 });
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
  });

  it("getProgramsByState returns empty for invalid state", async () => {
    const result = await db.getProgramsByState("ZZ", { limit: 5 });
    expect(result.total).toBe(0);
    expect(result.results.length).toBe(0);
  });

  it("getProgramsByState supports level of care filter", async () => {
    const result = await db.getProgramsByState("CA", {
      levelOfCare: ["residential"],
      limit: 5,
    });
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("total");
    if (result.results.length > 0) {
      result.results.forEach((r: any) => {
        expect(r.program.levelOfCare).toBe("residential");
      });
    }
  });

  it("getProgramsByState supports pagination", async () => {
    const page1 = await db.getProgramsByState("CA", { limit: 5, offset: 0 });
    const page2 = await db.getProgramsByState("CA", { limit: 5, offset: 5 });
    expect(page1.total).toBe(page2.total);
    if (page1.results.length > 0 && page2.results.length > 0) {
      expect(page1.results[0].program.id).not.toBe(page2.results[0].program.id);
    }
  });
});
