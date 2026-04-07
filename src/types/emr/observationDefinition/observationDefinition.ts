import type { Code } from "../../base/code/code";
import type { QualifiedRange } from "../../base/qualifiedRange/qualifiedRange";
import type { SlugConfig } from "../../base/slug/slugConfig";

export enum ObservationDefinitionStatus {
  draft = "draft",
  active = "active",
  retired = "retired",
  unknown = "unknown",
}

export enum QuestionType {
  boolean = "boolean",
  decimal = "decimal",
  integer = "integer",
  dateTime = "dateTime",
  time = "time",
  string = "string",
  quantity = "quantity",
}

export interface ObservationDefinitionComponentSpec {
  code: Code;
  permitted_data_type: QuestionType;
  permitted_unit: Code | null;
  qualified_ranges?: QualifiedRange[];
}

export interface ObservationDefinitionComponentCreateSpec extends Omit<
  ObservationDefinitionComponentSpec,
  "qualified_ranges"
> {
  qualified_ranges?: QualifiedRange[];
}

export interface BaseObservationDefinitionSpec {
  id: string;
  slug: string;
  title: string;
  status: ObservationDefinitionStatus;
  description: string;
  category: string;
  code: Code;
  permitted_data_type: QuestionType;
  component: ObservationDefinitionComponentSpec[];
  body_site: Code | null;
  method: Code | null;
  permitted_unit: Code | null;
  derived_from_uri?: string;
  qualified_ranges: QualifiedRange[];
  slug_config: SlugConfig;
}

export interface ObservationDefinitionCreateSpec extends Omit<
  BaseObservationDefinitionSpec,
  "id" | "slug_config" | "slug" | "qualified_ranges" | "component"
> {
  slug_value: string;
  facility: string;
  qualified_ranges?: QualifiedRange[];
  component: ObservationDefinitionComponentCreateSpec[];
}

export interface ObservationDefinitionReadSpec extends BaseObservationDefinitionSpec {
  version?: number;
}

export const OBSERVATION_DEFINITION_CATEGORY = [
  "social_history",
  "vital_signs",
  "imaging",
  "laboratory",
  "procedure",
  "survey",
  "exam",
  "therapy",
  "activity",
] as string[];

export type ObservationRow = {
  title: string;
  slug_value: string;
  description: string;
  category: string;
  status: string;
  code: Code;
  permitted_data_type: string;
  component: ObservationDefinitionComponentSpec[];
  body_site: Code | null;
  method: Code | null;
  permitted_unit: Code | null;
  qualified_ranges: QualifiedRange[];
  derived_from_uri?: string;
};

export type ObservationProcessedRow = {
  rowIndex: number;
  data: ObservationRow;
  errors: string[];
};
