import type { Code } from "@/types/base/code/code";
import type { Condition } from "@/types/base/condition/condition";

export interface Interpretation {
  display: string;
  highlight?: boolean;
  code?: Code;
}

export interface NumericRange {
  interpretation: Interpretation;
  min?: string;
  max?: string;
}

export interface CustomValueSet {
  interpretation: Interpretation;
  valueset: string;
}

export enum InterpretationType {
  ranges = "ranges",
  valuesets = "valuesets",
}

export interface QualifiedRange {
  id?: number;
  title?: string;
  default_interpretation?: Interpretation;
  conditions?: Condition[];
  ranges: NumericRange[];
  normal_coded_value_set?: string;
  critical_coded_value_set?: string;
  abnormal_coded_value_set?: string;
  valueset_interpretation?: CustomValueSet[];
  _interpretation_type: InterpretationType;
}
