import type { Code } from "../../base/code/code";

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
