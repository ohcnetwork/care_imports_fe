import type { Code } from "../../base/code/code";
import type { SlugConfig } from "../../base/slug/slugConfig";

// ─── Enums (aligned with core FE) ──────────────────────────────────

export enum ActivityDefinitionStatus {
  draft = "draft",
  active = "active",
  retired = "retired",
  unknown = "unknown",
}

export enum ActivityDefinitionClassification {
  laboratory = "laboratory",
  imaging = "imaging",
  surgical_procedure = "surgical_procedure",
  counselling = "counselling",
  education = "education",
}

export enum ActivityDefinitionKind {
  service_request = "service_request",
}

// ─── API Specs (aligned with core FE) ──────────────────────────────

export interface BaseActivityDefinitionSpec {
  id: string;
  slug: string;
  title: string;
  derived_from_uri: string | null;
  status: ActivityDefinitionStatus;
  description: string;
  usage: string;
  classification: ActivityDefinitionClassification;
  kind: ActivityDefinitionKind;
  code: Code;
  body_site: Code | null;
  diagnostic_report_codes: Code[];
  slug_config: SlugConfig;
}

export interface ActivityDefinitionCreateSpec extends Omit<
  BaseActivityDefinitionSpec,
  "id" | "slug_config" | "slug"
> {
  slug_value: string;
  facility: string;
  specimen_requirements: string[];
  charge_item_definitions: string[];
  observation_result_requirements: string[];
  locations: string[];
  category: string;
  healthcare_service: string | null;
}

export interface ActivityDefinitionUpdateSpec extends ActivityDefinitionCreateSpec {
  id: string;
}

export interface ActivityDefinitionReadSpec extends BaseActivityDefinitionSpec {
  version?: number;
  specimen_requirements: unknown[];
  charge_item_definitions: unknown[];
  observation_result_requirements: unknown[];
  locations: unknown[];
  category: unknown;
  healthcare_service: unknown;
}

export interface ActivityDefinitionUpsertRequest {
  datapoints: ActivityDefinitionCreateSpec[];
}

// ─── Import Row Types ──────────────────────────────────────────────

export type ActivityDefinitionRow = {
  title: string;
  slug_value: string;
  description: string;
  usage: string;
  status: string;
  classification: string;
  kind: string;
  code: Code;
  body_site: Code | null;
  diagnostic_report_codes: Code[];
  derived_from_uri?: string;
  category_name: string;
  specimen_slugs: string[];
  observation_slugs: string[];
  charge_item_slugs: string[];
  charge_item_price?: string;
  location_names: string[];
  healthcare_service_name?: string;
};

export type ActivityDefinitionProcessedRow = {
  rowIndex: number;
  data: ActivityDefinitionRow;
  errors: string[];
};

export interface ParseActivityDefinitionOptions {
  requireChargeItemPrice?: boolean;
}
