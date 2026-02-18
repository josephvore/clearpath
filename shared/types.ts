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
  insurance?: string[];
  substances?: string[];
  accreditations?: string[];
  genderPolicy?: string;
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  minQuality?: number;
  limit?: number;
  offset?: number;
};

export type GuidedFinderAnswers = {
  concerns: string[];
  levelOfCare: string;
  location: { state?: string; city?: string; telehealth?: boolean };
  insurance: string[];
  paymentOptions: string[];
  substances?: string[];
  ageGroup?: string;
  gender?: string;
  specialNeeds?: string[];
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
  { value: "detox", label: "Detoxification" },
  { value: "sober_living", label: "Sober Living" },
  { value: "aftercare", label: "Aftercare" },
] as const;

export const PROGRAM_TYPE_OPTIONS = [
  { value: "detox", label: "Detoxification" },
  { value: "residential", label: "Residential Treatment" },
  { value: "php", label: "Partial Hospitalization" },
  { value: "iop", label: "Intensive Outpatient" },
  { value: "outpatient", label: "Outpatient" },
  { value: "aftercare", label: "Aftercare/Alumni" },
  { value: "family", label: "Family Program" },
  { value: "sober_living", label: "Sober Living" },
  { value: "crisis", label: "Crisis Intervention" },
] as const;

export const FACILITY_TYPE_OPTIONS = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "residential", label: "Residential Center" },
  { value: "detox_center", label: "Detox Center" },
  { value: "sober_living", label: "Sober Living Home" },
  { value: "php_facility", label: "PHP Facility" },
  { value: "iop_facility", label: "IOP Facility" },
  { value: "telehealth_only", label: "Telehealth Only" },
  { value: "crisis_center", label: "Crisis Center" },
  { value: "mat_clinic", label: "MAT Clinic" },
] as const;

export const GENDER_POLICY_OPTIONS = [
  { value: "co_ed", label: "Co-Ed" },
  { value: "male_only", label: "Male Only" },
  { value: "female_only", label: "Female Only" },
  { value: "lgbtq_affirming", label: "LGBTQ+ Affirming" },
] as const;

export const PAYMENT_OPTIONS = [
  { value: "self_pay", label: "Self Pay" },
  { value: "medicaid", label: "Medicaid" },
  { value: "medicare", label: "Medicare" },
  { value: "commercial", label: "Commercial Insurance" },
  { value: "sliding_scale", label: "Sliding Scale" },
  { value: "military", label: "Military/VA" },
] as const;

export const COMMON_INSURANCE = [
  "Blue Cross Blue Shield",
  "Aetna",
  "Cigna",
  "UnitedHealthcare",
  "Humana",
  "Kaiser Permanente",
  "Anthem",
  "Medicaid",
  "Medicare",
  "TRICARE",
  "VA/Military",
  "Magellan Health",
  "Optum",
] as const;

export const COMMON_SUBSTANCES = [
  "Alcohol",
  "Opioids",
  "Opioids (Heroin)",
  "Opioids (Fentanyl)",
  "Cocaine",
  "Methamphetamine",
  "Cannabis",
  "Benzodiazepines",
  "Prescription Drugs",
  "Stimulants",
  "Tobacco/Nicotine",
  "Gambling",
] as const;

export const COMMON_SPECIALIZATIONS = [
  "Dual Diagnosis",
  "Trauma/PTSD",
  "Co-occurring Disorders",
  "Chronic Pain",
  "Eating Disorders",
  "Veterans",
  "First Responders",
  "Adolescents",
  "Young Adults",
  "Pregnant Women",
  "LGBTQ+",
  "Faith-Based",
  "Executive/Professional",
  "Court-Ordered",
] as const;

export const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
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

export function formatFacilityType(ft: string): string {
  const found = FACILITY_TYPE_OPTIONS.find((o) => o.value === ft);
  return found?.label ?? ft.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatProgramType(pt: string): string {
  const found = PROGRAM_TYPE_OPTIONS.find((o) => o.value === pt);
  return found?.label ?? pt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
