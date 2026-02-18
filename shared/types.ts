/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Search filter types shared between client and server
export type SearchFilters = {
  query?: string;
  levelOfCare?: string[];
  telehealth?: boolean;
  specialties?: string[];
  conditions?: string[];
  populations?: string[];
  paymentOptions?: string[];
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
};

export type UserNeedsInput = {
  location?: string;
  lat?: number;
  lng?: number;
  distanceMiles?: number;
  levelOfCareTarget?: string[];
  ageGroup?: string;
  primaryConcerns?: string[];
  substanceRelated?: boolean;
  substanceList?: string[];
  telehealthOk?: boolean;
  insuranceType?: string[];
  budget?: string;
};

export const LEVEL_OF_CARE_OPTIONS = [
  { value: "crisis", label: "Crisis Stabilization" },
  { value: "inpatient", label: "Inpatient" },
  { value: "residential", label: "Residential" },
  { value: "php", label: "Partial Hospitalization (PHP)" },
  { value: "iop", label: "Intensive Outpatient (IOP)" },
  { value: "outpatient", label: "Outpatient" },
  { value: "detox", label: "Detox" },
  { value: "sober_living", label: "Sober Living" },
  { value: "aftercare", label: "Aftercare" },
] as const;

export const PAYMENT_OPTIONS = [
  { value: "self_pay", label: "Self Pay" },
  { value: "medicaid", label: "Medicaid" },
  { value: "medicare", label: "Medicare" },
  { value: "commercial", label: "Commercial Insurance" },
  { value: "sliding_scale", label: "Sliding Scale" },
  { value: "military", label: "Military/VA" },
] as const;

export const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "residential", label: "Residential Center" },
  { value: "detox_center", label: "Detox Center" },
  { value: "telehealth_only", label: "Telehealth Only" },
  { value: "unknown", label: "Unknown" },
] as const;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

export function getConfidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600";
  if (confidence >= 0.5) return "text-yellow-600";
  return "text-red-500";
}

export function formatLevelOfCare(loc: string): string {
  const found = LEVEL_OF_CARE_OPTIONS.find((o) => o.value === loc);
  return found?.label ?? loc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
