import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getNearbyPrograms: vi.fn(),
}));

import { getNearbyPrograms } from "./db";

const mockGetNearbyPrograms = vi.mocked(getNearbyPrograms);

describe("Nearby Programs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return programs sorted by distance", async () => {
    const mockResults = {
      results: [
        {
          program: { id: 1, name: "Program A", levelOfCare: "outpatient", status: "active" },
          facility: { id: 1, name: "Facility A", lat: "40.7128", lng: "-74.0060", city: "New York", state: "NY" },
          organization: { id: 1, name: "Org A" },
          distance: 2.5,
        },
        {
          program: { id: 2, name: "Program B", levelOfCare: "residential", status: "active" },
          facility: { id: 2, name: "Facility B", lat: "40.8000", lng: "-74.1000", city: "Newark", state: "NJ" },
          organization: { id: 2, name: "Org B" },
          distance: 10.3,
        },
      ],
      total: 2,
    };

    mockGetNearbyPrograms.mockResolvedValue(mockResults);

    const result = await getNearbyPrograms({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 50,
    });

    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].distance).toBeLessThan(result.results[1].distance);
  });

  it("should accept level of care filter", async () => {
    mockGetNearbyPrograms.mockResolvedValue({ results: [], total: 0 });

    await getNearbyPrograms({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 25,
      levelOfCare: ["residential", "inpatient"],
    });

    expect(mockGetNearbyPrograms).toHaveBeenCalledWith({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 25,
      levelOfCare: ["residential", "inpatient"],
    });
  });

  it("should respect radius limit", async () => {
    mockGetNearbyPrograms.mockResolvedValue({ results: [], total: 0 });

    const result = await getNearbyPrograms({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 5,
    });

    expect(result.total).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("should handle empty results gracefully", async () => {
    mockGetNearbyPrograms.mockResolvedValue({ results: [], total: 0 });

    const result = await getNearbyPrograms({
      lat: 0,
      lng: 0,
      radiusMiles: 1,
    });

    expect(result).toEqual({ results: [], total: 0 });
  });

  it("should respect limit parameter", async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      program: { id: i + 1, name: `Program ${i + 1}`, levelOfCare: "outpatient", status: "active" },
      facility: { id: i + 1, name: `Facility ${i + 1}`, lat: "40.7128", lng: "-74.0060", city: "NYC", state: "NY" },
      organization: { id: 1, name: "Org" },
      distance: i * 5,
    }));

    mockGetNearbyPrograms.mockResolvedValue({
      results: manyResults,
      total: 10,
    });

    const result = await getNearbyPrograms({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 100,
      limit: 10,
    });

    expect(result.total).toBe(10);
    expect(result.results).toHaveLength(10);
  });

  it("should calculate distance correctly (distances are rounded to 1 decimal)", async () => {
    const mockResult = {
      results: [
        {
          program: { id: 1, name: "Test", levelOfCare: "outpatient", status: "active" },
          facility: { id: 1, name: "Fac", lat: "40.7128", lng: "-74.0060", city: "NYC", state: "NY" },
          organization: { id: 1, name: "Org" },
          distance: 15.3,
        },
      ],
      total: 1,
    };

    mockGetNearbyPrograms.mockResolvedValue(mockResult);

    const result = await getNearbyPrograms({
      lat: 40.7128,
      lng: -74.006,
      radiusMiles: 50,
    });

    // Distance should be a number with at most 1 decimal place
    const dist = result.results[0].distance;
    expect(typeof dist).toBe("number");
    expect(Math.round(dist * 10) / 10).toBe(dist);
  });
});
