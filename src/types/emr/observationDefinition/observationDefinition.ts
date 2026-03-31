import type { Code } from "../../base/code/code";

export type JsonObject = Record<string, unknown>;

export type ObservationComponentPayload = JsonObject;

export type ObservationRow = {
  title: string;
  slug_value: string;
  description: string;
  category: string;
  status: string;
  code: Code;
  permitted_data_type: string;
  component: ObservationComponentPayload[];
  body_site: Code | null;
  method: Code | null;
  permitted_unit: Code | null;
  qualified_ranges: JsonObject[];
  derived_from_uri?: string;
};

export type ObservationProcessedRow = {
  rowIndex: number;
  data: ObservationRow;
  errors: string[];
};
