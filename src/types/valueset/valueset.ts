/**
 * Allowed filter operators for ValueSet compose entries.
 */
export const VALUESET_FILTER_OPS = [
  "=",
  "is-a",
  "descendent-of",
  "is-not-a",
  "regex",
  "in",
  "not-in",
  "generalizes",
  "child-of",
  "descendent-leaf",
  "exists",
] as const;

export type ValueSetFilterOp = (typeof VALUESET_FILTER_OPS)[number];

/**
 * Allowed code systems.
 */
export const VALUESET_CODE_SYSTEMS = [
  "http://loinc.org",
  "http://snomed.info/sct",
  "http://unitsofmeasure.org",
] as const;

export type CodeSystem = (typeof VALUESET_CODE_SYSTEMS)[number];

export const CODE_SYSTEM_LABELS: Record<CodeSystem, string> = {
  "http://loinc.org": "LOINC",
  "http://snomed.info/sct": "SNOMED CT",
  "http://unitsofmeasure.org": "Units of Measure",
};

export const TERMINOLOGY_SYSTEMS = {
  LOINC: "http://loinc.org",
  SNOMED: "http://snomed.info/sct",
  UCUM: "http://unitsofmeasure.org",
} as const;

export type TerminologySystem = keyof typeof TERMINOLOGY_SYSTEMS;

export enum ValueSetStatus {
  ACTIVE = "active",
  DRAFT = "draft",
  RETIRED = "retired",
  UNKNOWN = "unknown",
}

export interface ValueSetFilter {
  op: string;
  value: string;
  property: string;
}

export interface ValueSetConcept {
  code: string;
  display: string;
}

export interface ValueSetInclude {
  filter?: ValueSetFilter[];
  system: string;
  concept?: ValueSetConcept[];
}

export interface ValueSetCompose {
  include: ValueSetInclude[];
  exclude: ValueSetInclude[];
}

export interface ValueSetBase {
  slug: string;
  name: string;
  description: string;
  compose: ValueSetCompose;
  status: ValueSetStatus;
  is_system_defined: boolean;
}

export interface ValueSetRead extends ValueSetBase {
  id: string;
  created_by: string | null;
  updated_by: string | null;
}

export type ValueSetCreate = ValueSetBase;

export interface ValueSetUpdate extends ValueSetBase {
  id: string;
}

export interface ValueSetCodeMetadata {
  code: string;
  display: string;
  name: string;
  system: string;
  version: string;
  inactive: boolean;
}

export interface ValueSetLookupRequest {
  system: string;
  code: string;
}

export interface ValueSetLookupResponse {
  designations: { details: unknown; context: Record<string, unknown> }[];
  metadata: ValueSetCodeMetadata;
  properties: Record<string, unknown>;
}
